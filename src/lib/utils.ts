import { 
  Utensils, Car, ShoppingBag, FileText, HeartPulse, Gamepad2, Briefcase, ArrowUpDown 
} from "lucide-react";

// Helper to map category name to Lucide Icon
export const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Food & Restaurants": return Utensils;
    case "Transportation": return Car;
    case "Shopping": return ShoppingBag;
    case "Bills & Utilities": return FileText;
    case "Healthcare": return HeartPulse;
    case "Entertainment": return Gamepad2;
    case "Salary": return Briefcase;
    default: return ArrowUpDown;
  }
};
