export interface CardData {
  id: string;
  color: string;
  label: string;
  headline: string;
  reward: string;
  /** Optional link for "Currently at" (e.g. company URL) */
  url?: string;
  /** Optional image URL for vemula-style card tile */
  image?: string;
}

export const cards: CardData[] = [
  { id: "1", color: "#00D4FF", label: "EXCLUSIVE DEAL", headline: "Scratch to unlock your exclusive discount ✦", reward: "20% OFF" },
  { id: "2", color: "#1B5E20", label: "MEMBER REWARD", headline: "A reward is hiding underneath ⟡", reward: "FREE SHIPPING" },
  { id: "3", color: "#D32F2F", label: "FLASH SALE", headline: "Flash deals disappear fast ⚡", reward: "₹500 BACK" },
  { id: "4", color: "#F9A825", label: "LUCKY DRAW", headline: "Feeling lucky today? 🎯", reward: "JACKPOT 50%" },
  { id: "5", color: "#1A237E", label: "VIP ACCESS", headline: "VIP access — just for you ◆", reward: "BOGO FREE" },
  { id: "6", color: "#FF6F61", label: "BONUS GIFT", headline: "A little bonus never hurts 🎁", reward: "TRY AGAIN" },
  { id: "7", color: "#37474F", label: "MYSTERY BOX", headline: "What's inside the mystery box? ✧", reward: "20% OFF" },
  { id: "8", color: "#7B1FA2", label: "CASHBACK", headline: "Cash back in your pocket 💰", reward: "₹500 BACK" },
];
