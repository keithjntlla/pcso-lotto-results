import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawResult } from '../data/seedData';

const TICKETS_KEY = '@pcso_my_tickets';

export interface Ticket {
  id: string;
  date: string; // YYYY-MM-DD
  drawTime: '2PM' | '5PM' | '9PM';
  combination: string; // e.g. "4-2-6"
  playType: 'Standard' | 'Rambolito';
  winStatus: 'Pending' | 'Won' | 'Lost';
  wonAmount: number;
}

/**
 * Load all user tickets from local storage.
 */
export async function getMyTickets(): Promise<Ticket[]> {
  try {
    const cached = await AsyncStorage.getItem(TICKETS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as Ticket[];
      if (parsed) {
        // Sort descending by date
        return parsed.sort((a, b) => b.date.localeCompare(a.date));
      }
    }
    return [];
  } catch (error) {
    console.error('Tickets: Error reading local tickets:', error);
    return [];
  }
}

/**
 * Save user tickets to local storage.
 */
export async function saveMyTickets(tickets: Ticket[]): Promise<void> {
  try {
    const sorted = [...tickets].sort((a, b) => b.date.localeCompare(a.date));
    await AsyncStorage.setItem(TICKETS_KEY, JSON.stringify(sorted));
  } catch (error) {
    console.error('Tickets: Error saving tickets cache:', error);
  }
}

/**
 * Check pending tickets against draw results and update their statuses.
 */
export function checkTicketsAgainstResults(
  tickets: Ticket[],
  results: DrawResult[]
): { updatedTickets: Ticket[]; newWinsCount: number } {
  let newWinsCount = 0;

  const updatedTickets = tickets.map((ticket): Ticket => {
    // If ticket is already resolved, don't check again
    if (ticket.winStatus !== 'Pending') {
      return ticket;
    }

    // Find the draw result for the ticket's date
    const drawItem = results.find((r) => r.date === ticket.date);
    if (!drawItem) {
      return ticket; // Still pending, result not yet available
    }

    // Get the specific draw result based on the ticket's draw time
    let winningComb = '';
    if (ticket.drawTime === '2PM') winningComb = drawItem.draw2pm;
    else if (ticket.drawTime === '5PM') winningComb = drawItem.draw5pm;
    else if (ticket.drawTime === '9PM') winningComb = drawItem.draw9pm;

    // If winning combination is not yet drawn
    if (!winningComb || winningComb === '--') {
      return ticket; // Still pending
    }

    const ticketDigits = ticket.combination.split('-');
    const winningDigits = winningComb.split('-');

    // Ensure they have valid 3D digits before verifying
    if (ticketDigits.length !== 3 || winningDigits.length !== 3) {
      return {
        ...ticket,
        winStatus: 'Lost',
        wonAmount: 0,
      };
    }

    // 1. Standard Play: Must match in exact order
    if (ticket.playType === 'Standard') {
      if (ticket.combination === winningComb) {
        newWinsCount++;
        return {
          ...ticket,
          winStatus: 'Won',
          wonAmount: 4500, // Standard 3D prize is ₱4,500
        };
      } else {
        return {
          ...ticket,
          winStatus: 'Lost',
          wonAmount: 0,
        };
      }
    }

    // 2. Rambolito Play: Can match in any order
    const ticketSorted = [...ticketDigits].sort().join('-');
    const winningSorted = [...winningDigits].sort().join('-');

    if (ticketSorted === winningSorted) {
      newWinsCount++;

      // Check unique digits size to determine Rambolito 3 or Rambolito 6
      const uniqueDigits = new Set(ticketDigits);
      let prize = 750; // Rambolito 6 (3 unique digits, e.g. 1-2-3)
      if (uniqueDigits.size === 2) {
        prize = 1500; // Rambolito 3 (2 identical digits, e.g. 2-2-5)
      }

      return {
        ...ticket,
        winStatus: 'Won',
        wonAmount: prize,
      };
    } else {
      return {
        ...ticket,
        winStatus: 'Lost',
        wonAmount: 0,
      };
    }
  });

  return { updatedTickets, newWinsCount };
}

/**
 * Add a new ticket and verify it instantly against current cache.
 */
export async function addMyTicket(
  newTicket: Omit<Ticket, 'id' | 'winStatus' | 'wonAmount'>,
  results: DrawResult[]
): Promise<Ticket[]> {
  try {
    const tickets = await getMyTickets();

    const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const draftTicket: Ticket = {
      ...newTicket,
      id,
      winStatus: 'Pending',
      wonAmount: 0,
    };

    // Verify instantly against existing draw cache
    const { updatedTickets } = checkTicketsAgainstResults([draftTicket], results);
    const verifiedTicket = updatedTickets[0];

    const updatedList = [verifiedTicket, ...tickets];
    await saveMyTickets(updatedList);
    return updatedList;
  } catch (error) {
    console.error('Tickets: Failed to add ticket', error);
    return [];
  }
}

/**
 * Delete a ticket.
 */
export async function deleteMyTicket(id: string): Promise<Ticket[]> {
  try {
    const tickets = await getMyTickets();
    const filtered = tickets.filter((t) => t.id !== id);
    await saveMyTickets(filtered);
    return filtered;
  } catch (error) {
    console.error('Tickets: Failed to delete ticket', error);
    return [];
  }
}

/**
 * Clear all tickets.
 */
export async function clearAllTickets(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TICKETS_KEY);
  } catch (error) {
    console.error('Tickets: Failed to clear tickets', error);
  }
}
