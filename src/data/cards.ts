export interface CardData {
  id: string;
  color: string;
  label: string;
  headline: string;
  reward: string;
  url?: string;
  image?: string;
  video?: string;
  subtext?: string;
  /** If false, card is not included in the fanned stack (still used for dots/count). */
  includeInStack?: boolean;
}

export const cards: CardData[] = [
  {
    id: "2",
    color: "#0f5f34",
    label: "Truffle Security",
    headline: "Vibe Coding",
    subtext: "When the code writes itself and you just watch.",
    reward: "Truffle Security",
    url: "https://www.trufflesecurity.com",
    image: "https://vemula.me/images/cards/stax2.png",
  },
  {
    id: "3",
    color: "#d32622",
    label: "CNN",
    headline: "Doomscrolling",
    subtext: "You know you should stop. You won't.",
    reward: "CNN",
    url: "https://www.cnn.com",
    image: "https://vemula.me/images/cards/truffle.png",
  },
  {
    id: "4",
    color: "#f4a51f",
    label: "Prototypes.com",
    headline: "Ship It",
    subtext: "Perfect is the enemy of deployed.",
    reward: "Prototypes.com",
    url: "https://prototypes.com",
    image: "https://vemula.me/images/cards/cnn.png",
    includeInStack: false,
  },
  {
    id: "5",
    color: "#1d2f96",
    label: "Substack",
    headline: "Burnout",
    subtext: "Everything is fine. Everything is fine. Everything is\u2014",
    reward: "Substack",
    url: "https://substack.com",
    image: "https://vemula.me/images/cards/prototypes.png",
    includeInStack: false,
  },
  {
    id: "6",
    color: "#f26e52",
    label: "Dribbble",
    headline: "Main Character",
    subtext: "Today the algorithm chose you.",
    reward: "Dribbble",
    url: "https://dribbble.com",
    image: "https://vemula.me/images/cards/substack.png",
  },
  {
    id: "7",
    color: "#2d3d47",
    label: "LinkedIn",
    headline: "Touch Typing",
    subtext: "Your keyboard doesn't need you looking at it.",
    reward: "LinkedIn",
    url: "https://linkedin.com",
    image: "https://vemula.me/images/cards/dribbble.png",
    includeInStack: false,
  },
  {
    id: "8",
    color: "#6326a8",
    label: "Open to Work",
    headline: "404",
    subtext: "You weren't supposed to find this.",
    reward: "Open to Work",
    image: "https://vemula.me/images/cards/linkedin.png",
  },
  // Touch Grass as the front (top) card in the stack
  {
    id: "1",
    color: "#1fc7ff",
    label: "Touch Grass",
    headline: "Touch Grass",
    subtext: "Some things you can only understand by feeling them.",
    reward: "STAX.AI",
    url: "https://stax.ai",
    image: "https://vemula.me/images/cards/stax1.png",
    video: undefined,
  },
];
