import scrollCardImage from '../assets/Scroll.svg';

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
  // Scroll card (opens ScrollInteraction)
  {
    id: "1",
    color: "#2E84FF",
    label: "Scroll",
    headline: "Scroll",
    subtext: "Totally addictive, totally pointless.",
    reward: "Scroll",
    image: scrollCardImage,
    video: undefined,
  },
  {
    id: "9",
    color: "#CFAB71",
    label: "Diary",
    headline: "Diary",
    subtext: "words that fade away",
    reward: "Diary",
  },
  {
    id: "11",
    color: "#646464",
    label: "more coming soon",
    headline: "more coming soon",
    subtext: "Building more",
    reward: "more coming soon",
  },
  {
    id: "10",
    color: "#646464",
    label: "being watched",
    headline: "being watched",
    subtext: "You are being watched",
    reward: "being watched",
  },
];
