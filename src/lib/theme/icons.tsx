import "server-only";

import { FaFacebookF, FaLinkedinIn, FaTelegramPlane, FaWhatsapp } from "react-icons/fa";
import {
  HiBars3,
  HiCalendarDays,
  HiChatBubbleBottomCenterText,
  HiChevronDown,
  HiMagnifyingGlass,
  HiMoon,
  HiSun,
  HiTag,
  HiUser,
} from "react-icons/hi2";
import { MdEmail } from "react-icons/md";

export type ThemeIcons = {
  sun: string;
  moon: string;
  menu: string;
  search: string;
  calendar: string;
  user: string;
  category: string;
  facebook: string;
  linkedin: string;
  email: string;
  whatsapp: string;
  telegram: string;
  sms: string;
  chevronDown: string;
};

let cachedIcons: ThemeIcons | null = null;

export async function getThemeIcons(): Promise<ThemeIcons> {
  if (cachedIcons) {
    return cachedIcons;
  }

  const { renderToStaticMarkup } = await import("react-dom/server");

  cachedIcons = {
    sun: renderToStaticMarkup(<HiSun className="w-3.5 h-3.5" aria-hidden="true" />),
    moon: renderToStaticMarkup(<HiMoon className="w-3.5 h-3.5" aria-hidden="true" />),
    menu: renderToStaticMarkup(<HiBars3 className="w-5 h-5" aria-hidden="true" />),
    search: renderToStaticMarkup(<HiMagnifyingGlass className="w-3.5 h-3.5" aria-hidden="true" />),
    calendar: renderToStaticMarkup(<HiCalendarDays className="w-3.5 h-3.5" aria-hidden="true" />),
    user: renderToStaticMarkup(<HiUser className="w-3.5 h-3.5" aria-hidden="true" />),
    category: renderToStaticMarkup(<HiTag className="w-3.5 h-3.5" aria-hidden="true" />),
    facebook: renderToStaticMarkup(<FaFacebookF className="w-3.5 h-3.5" aria-hidden="true" />),
    linkedin: renderToStaticMarkup(<FaLinkedinIn className="w-3.5 h-3.5" aria-hidden="true" />),
    email: renderToStaticMarkup(<MdEmail className="w-3.5 h-3.5" aria-hidden="true" />),
    whatsapp: renderToStaticMarkup(<FaWhatsapp className="w-3.5 h-3.5" aria-hidden="true" />),
    telegram: renderToStaticMarkup(<FaTelegramPlane className="w-3.5 h-3.5" aria-hidden="true" />),
    sms: renderToStaticMarkup(<HiChatBubbleBottomCenterText className="w-3.5 h-3.5" aria-hidden="true" />),
    chevronDown: renderToStaticMarkup(<HiChevronDown className="w-4 h-4" aria-hidden="true" />),
  };

  return cachedIcons;
}
