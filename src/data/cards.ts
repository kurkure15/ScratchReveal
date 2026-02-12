export interface CardData {
  id: string;
  color: string;
  label: string;
  headline: string;
  reward: string;
  url?: string;
  image?: string;
  /** If false, card is not included in the fanned stack (still used for dots/count). */
  includeInStack?: boolean;
}

export const cards: CardData[] = [
  {
    id: "2",
    color: "#0f5f34",
    label: "Truffle Security",
    headline: "Building modern AppSec and secrets tooling.",
    reward: "Truffle Security",
    url: "https://www.trufflesecurity.com",
    image: "https://vemula.me/images/cards/stax2.png",
  },
  {
    id: "3",
    color: "#d32622",
    label: "CNN",
    headline: "Worked on reliability and distribution at global scale.",
    reward: "CNN",
    url: "https://www.cnn.com",
    image: "https://vemula.me/images/cards/truffle.png",
  },
  {
    id: "4",
    color: "#f4a51f",
    label: "Prototypes.com",
    headline: "Rapid concepting and product storytelling.",
    reward: "Prototypes.com",
    url: "https://prototypes.com",
    image: "https://vemula.me/images/cards/cnn.png",
    includeInStack: false,
  },
  {
    id: "5",
    color: "#1d2f96",
    label: "Substack",
    headline: "Writing about code, product, and systems work.",
    reward: "Substack",
    url: "https://substack.com",
    image: "https://vemula.me/images/cards/prototypes.png",
    includeInStack: false,
  },
  {
    id: "6",
    color: "#f26e52",
    label: "Dribbble",
    headline: "Design experiments and interaction snapshots.",
    reward: "Dribbble",
    url: "https://dribbble.com",
    image: "https://vemula.me/images/cards/substack.png",
  },
  {
    id: "7",
    color: "#2d3d47",
    label: "LinkedIn",
    headline: "Career history and project breakdowns.",
    reward: "LinkedIn",
    url: "https://linkedin.com",
    image: "https://vemula.me/images/cards/dribbble.png",
    includeInStack: false,
  },
  {
    id: "8",
    color: "#6326a8",
    label: "Open to Work",
    headline: "Always open to high leverage engineering conversations.",
    reward: "Open to Work",
    image: "https://vemula.me/images/cards/linkedin.png",
  },
  // STAX.AI as the front (top) card in the stack
  {
    id: "1",
    color: "#1fc7ff",
    label: "STAX.AI",
    headline: "Building AI products with security first architecture.",
    reward: "STAX.AI",
    url: "https://stax.ai",
    image: "https://vemula.me/images/cards/stax1.png",
  },
];
