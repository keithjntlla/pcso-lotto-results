import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncLottoResults } from './storage';

const BACKGROUND_FETCH_TASK = 'background-lotto-sync';

// 1. Define the task in global scope
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('[Background Task] Running lotto sync...');
    await syncLottoResults();
    console.log('[Background Task] Sync complete.');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[Background Task] Failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// 2. Helper to register task with the OS
export async function registerBackgroundFetchAsync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 15, // 15 minutes (minimum interval in seconds)
      });
      console.log('[Background Task] Task registered successfully');
    } else {
      console.log('[Background Task] Task already registered');
    }
  } catch (err) {
    console.log('[Background Task] Registration failed:', err);
  }
}
