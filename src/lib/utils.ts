import {
  Utensils, Car, ShoppingBag, FileText, HeartPulse, Gamepad2, Briefcase, ArrowUpDown,
  Home, Smartphone, Shield, Landmark
} from "lucide-react";

// Helper to map category name to Lucide Icon
export const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Food & Restaurants": return Utensils;
    case "Transportation": return Car;
    case "Shopping": return ShoppingBag;
    case "Bills & Utilities": return FileText;
    case "Housing": return Home;
    case "Telecom": return Smartphone;
    case "Insurance": return Shield;
    case "Financing": return Landmark;
    case "Healthcare": return HeartPulse;
    case "Entertainment": return Gamepad2;
    case "Salary": return Briefcase;
    default: return ArrowUpDown;
  }
};
