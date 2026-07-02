import { DataProvider } from "./types";
import { MockDataProvider } from "./MockDataProvider";
import { SupabaseDataProvider } from "./SupabaseDataProvider";

// ============================================================================
// SYSTEM FEATURE FLAGS
// ============================================================================
// Set USE_MOCK_DATA to false to switch the entire application to Supabase.
// Set USE_MOCK_AI to false to switch the chatbot from Mock to real OpenAI (gpt-4o-mini).
// ============================================================================
export const USE_MOCK_DATA = true;
export const USE_MOCK_AI = false;

let activeProvider: DataProvider | null = null;

export const getDataProvider = (): DataProvider => {
  if (!activeProvider) {
    if (USE_MOCK_DATA) {
      activeProvider = new MockDataProvider();
    } else {
      activeProvider = new SupabaseDataProvider();
    }
  }
  return activeProvider;
};
