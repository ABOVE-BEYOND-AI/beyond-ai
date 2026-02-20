"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarBlank,
  MapPin,
  CurrencyGbp,
  Warning,
  Package,
  Bed,
  AirplaneTakeoff,
  AirplaneLanding,
  Car,
  ForkKnife,
  Martini,
  Confetti,
  Ticket,
  UserCircle,
  MagnifyingGlass,
  X,
  CaretRight,
  Users,
  ChartLineUp,
  Clock,
  ArrowsClockwise,
  CheckCircle,
  CaretDown,
  Trophy,
  TrendUp,
  Timer,
  Flag,
  Horse,
  TennisBall,
  Football,
  MusicNote,
  Star,
  Lightning,
  FlagCheckered,
} from "@phosphor-icons/react";
import type {
  SalesforceEvent,
  SalesforceOpportunityFull,
} from "@/lib/salesforce-types";
import {
  formatCurrency,
  daysUntil,
  EVENT_CATEGORY_COLORS,
  OPPORTUNITY_STAGES,
} from "@/lib/constants";

// ── Website Image Library ──

const IMAGE_BASE = "https://aboveandbeyond.group/wp-content/uploads/2025/12/";

const IMAGE_LIBRARY: Record<string, string> = {
  "1000 guineas": `${IMAGE_BASE}1000-Guineas.webp`,
  "1st test england vs new zealand": `${IMAGE_BASE}1st-Test-England-vs-New-Zealand.webp`,
  "2000 guineas": `${IMAGE_BASE}2000-Guineas.webp`,
  "24 hours of le mans": `${IMAGE_BASE}24-Hours-of-Le-Mans.webp`,
  "2nd test england vs new zealand": `${IMAGE_BASE}2nd-Test-England-vs-New-Zealand.webp`,
  "3rd test england vs new zealand": `${IMAGE_BASE}3rd-Test-England-vs-New-Zealand.webp`,
  "5th ashes test": `${IMAGE_BASE}5th-ashes-test.webp`,
  "atp finals": `${IMAGE_BASE}ATP-Finals.webp`,
  "ariana grande london concert": `${IMAGE_BASE}Ariana-Grande-London-Concert.webp`,
  "art basel": `${IMAGE_BASE}Art-BaseL.webp`,
  "asian games 2026": `${IMAGE_BASE}Asian-Games-2026.webp`,
  "australian open main draw": `${IMAGE_BASE}Australian-Open-Main-Draw.webp`,
  "australian open qualifying": `${IMAGE_BASE}Australian-Open-Qualifying.webp`,
  "australian open": `${IMAGE_BASE}Australian-Open-Main-Draw.webp`,
  "autumn nations series": `${IMAGE_BASE}Autumn-Nations-Series.webp`,
  "bbc proms": `${IMAGE_BASE}BBC-Proms.webp`,
  "bmw pga championship": `${IMAGE_BASE}BMW-PGA-Championship.webp`,
  "bst hyde park garth brooks": `${IMAGE_BASE}BST-Hyde-Park-Garth-Brooks.webp`,
  "bst hyde park lewis capaldi": `${IMAGE_BASE}BST-Hyde-Park-Lewis-Capaldi-Night-1.webp`,
  "bst hyde park": `${IMAGE_BASE}BST-Hyde-Park-Garth-Brooks.webp`,
  "barbarians v all blacks": `${IMAGE_BASE}Barbarians-v-All-Blacks-XV.webp`,
  "barbarians all blacks": `${IMAGE_BASE}Barbarians-v-All-Blacks-XV.webp`,
  "belmont stakes": `${IMAGE_BASE}Belmont-Stakes.webp`,
  "berlinale": `${IMAGE_BASE}Berlinale-Berlin-Film-Festival.webp`,
  "berlin film festival": `${IMAGE_BASE}Berlinale-Berlin-Film-Festival.webp`,
  "boston marathon": `${IMAGE_BASE}Boston-Marathon.webp`,
  "cannes film festival": `${IMAGE_BASE}Cannes-Film-Festival.webp`,
  "cheltenham festival": `${IMAGE_BASE}Cheltenham-Festival.webp`,
  "cheltenham": `${IMAGE_BASE}Cheltenham-Festival.webp`,
  "coachella": `${IMAGE_BASE}Coachella.webp`,
  "cowes week": `${IMAGE_BASE}Cowes-Week-Bicentenary.webp`,
  "creamfields": `${IMAGE_BASE}Creamfields.webp`,
  "crowdstrike 24 hours of spa": `${IMAGE_BASE}CrowdStrike-24-Hours-of-Spa.webp`,
  "24 hours of spa": `${IMAGE_BASE}CrowdStrike-24-Hours-of-Spa.webp`,
  "dp world tour championship": `${IMAGE_BASE}DP-World-Tour-Championship.webp`,
  "davis cup finals": `${IMAGE_BASE}Davis-Cup-Finals.webp`,
  "davis cup": `${IMAGE_BASE}Davis-Cup-Finals.webp`,
  "download festival": `${IMAGE_BASE}Download-Festival.webp`,
  "dubai world cup": `${IMAGE_BASE}Dubai-World-Cup.webp`,
  "bafta film awards": `${IMAGE_BASE}EE-BAFTA-Film-Awards.webp`,
  "bafta": `${IMAGE_BASE}EE-BAFTA-Film-Awards.webp`,
  "efl cup final": `${IMAGE_BASE}EFL-Cup-Final-Carabao-Cup.webp`,
  "carabao cup": `${IMAGE_BASE}EFL-Cup-Final-Carabao-Cup.webp`,
  "carabao cup final": `${IMAGE_BASE}EFL-Cup-Final-Carabao-Cup.webp`,
  "epcr challenge cup final": `${IMAGE_BASE}EPCR-Challenge-Cup-Final.webp`,
  "challenge cup final": `${IMAGE_BASE}EPCR-Challenge-Cup-Final.webp`,
  "eastbourne international": `${IMAGE_BASE}Eastbourne-International.webp`,
  "england vs ireland six nations": `${IMAGE_BASE}England-vs-Ireland-Six-Nations.webp`,
  "england vs wales six nations": `${IMAGE_BASE}England-vs-Wales-Six-Nations.webp`,
  "epsom derby": `${IMAGE_BASE}Epsom-Derby.webp`,
  "epsom oaks": `${IMAGE_BASE}Epsom-Oaks.webp`,
  "euroleague basketball final four": `${IMAGE_BASE}EuroLeague-Basketball-Final-Four.webp`,
  "european athletics championships": `${IMAGE_BASE}European-Athletics-Championships.webp`,
  "eurovision song contest": `${IMAGE_BASE}Eurovision-Song-Contest-Grand-Final.webp`,
  "eurovision": `${IMAGE_BASE}Eurovision-Song-Contest-Grand-Final.webp`,
  "fa cup final": `${IMAGE_BASE}FA-CUP-FINAL.webp`,
  "fa community shield": `${IMAGE_BASE}FA-Community-Shield.webp`,
  "community shield": `${IMAGE_BASE}FA-Community-Shield.webp`,
  "fa cup third round": `${IMAGE_BASE}FA-Cup-Third-Round.webp`,
  "fifa world cup": `${IMAGE_BASE}FIFA-WORLD-CUP.webp`,
  "world cup": `${IMAGE_BASE}FIFA-WORLD-CUP.webp`,
  "abu dhabi grand prix": `${IMAGE_BASE}Formula-1_-Abu-Dhabi-Grand-Prix.webp`,
  "australian grand prix": `${IMAGE_BASE}Formula-1_-Australian-Grand-Prix.webp`,
  "austrian grand prix": `${IMAGE_BASE}Formula-1_-Austrian-Grand-Prix.webp`,
  "azerbaijan grand prix": `${IMAGE_BASE}Formula-1_-Azerbaijan-Grand-Prix.webp`,
  "bahrain grand prix": `${IMAGE_BASE}Formula-1_-Bahrain-Grand-Prix.webp`,
  "belgian grand prix": `${IMAGE_BASE}Formula-1_-Belgian-Grand-Prix.webp`,
  "british grand prix": `${IMAGE_BASE}Formula-1_-British-Grand-Prix-Sprint.webp`,
  "canadian grand prix": `${IMAGE_BASE}Formula-1_-Canadian-Grand-Prix-Sprint.webp`,
  "chinese grand prix": `${IMAGE_BASE}Formula-1_-Chinese-Grand-Prix.webp`,
  "dutch grand prix": `${IMAGE_BASE}Formula-1_-Dutch-Grand-Prix-Sprint.webp`,
  "hungarian grand prix": `${IMAGE_BASE}Formula-1_-Hungarian-Grand-Prix.webp`,
  "italian grand prix": `${IMAGE_BASE}Formula-1_-Italian-Grand-Prix.webp`,
  "japanese grand prix": `${IMAGE_BASE}Formula-1_-Japanese-Grand-Prix.webp`,
  "las vegas grand prix": `${IMAGE_BASE}Formula-1_-Las-Vegas-Grand-Prix.webp`,
  "madrid grand prix": `${IMAGE_BASE}Formula-1_-Madrid-Grand-Prix.webp`,
  "mexican grand prix": `${IMAGE_BASE}Formula-1_-Mexican-Grand-Prix.webp`,
  "miami grand prix": `${IMAGE_BASE}Formula-1_-Miami-Grand-Prix.webp`,
  "qatar grand prix": `${IMAGE_BASE}Formula-1_-Qatar-Grand-Prix.webp`,
  "sao paulo grand prix": `${IMAGE_BASE}Formula-1_-Sao-Paulo-Grand-Prix.webp`,
  "saudi arabian gp": `${IMAGE_BASE}Formula-1_-Saudi-Arabian-GP.webp`,
  "saudi arabian grand prix": `${IMAGE_BASE}Formula-1_-Saudi-Arabian-GP.webp`,
  "singapore grand prix": `${IMAGE_BASE}Formula-1_-Singapore-Grand-Prix-Sprint.webp`,
  "spanish grand prix": `${IMAGE_BASE}Formula-1_-Spanish-Grand-Prix.webp`,
  "united states grand prix": `${IMAGE_BASE}Formula-1_-United-States-Grand-Prix.webp`,
  "monaco grand prix": `${IMAGE_BASE}monaco-grand-prix.webp`,
  "formula e london e prix": `${IMAGE_BASE}Formula-E-London-E-Prix.webp`,
  "london e prix": `${IMAGE_BASE}Formula-E-London-E-Prix.webp`,
  "france vs ireland six nations": `${IMAGE_BASE}France-vs-Ireland-Six-Nations.webp`,
  "french open": `${IMAGE_BASE}French-Open-Roland-Garros.webp`,
  "roland garros": `${IMAGE_BASE}French-Open-Roland-Garros.webp`,
  "frieze london": `${IMAGE_BASE}Frieze-London-_-Frieze-Masters.webp`,
  "frieze masters": `${IMAGE_BASE}Frieze-London-_-Frieze-Masters.webp`,
  "gallagher premiership final": `${IMAGE_BASE}Gallagher-Premiership-Final.webp`,
  "premiership final": `${IMAGE_BASE}Gallagher-Premiership-Final.webp`,
  "genesis scottish open": `${IMAGE_BASE}Genesis-Scottish-Open.webp`,
  "scottish open": `${IMAGE_BASE}Genesis-Scottish-Open.webp`,
  "giro ditalia": `${IMAGE_BASE}Giro-dItalia.webp`,
  "giro d'italia": `${IMAGE_BASE}Giro-dItalia.webp`,
  "goodwood festival of speed": `${IMAGE_BASE}Goodwood-Festival-of-Speed.webp`,
  "festival of speed": `${IMAGE_BASE}Goodwood-Festival-of-Speed.webp`,
  "goodwood members meeting": `${IMAGE_BASE}Goodwood-Members-Meeting.webp`,
  "goodwood revival": `${IMAGE_BASE}Goodwood-Revival.webp`,
  "goodwood": `${IMAGE_BASE}Goodwood-Festival-of-Speed.webp`,
  "grand national": `${IMAGE_BASE}Grand-National-LOCATION-Liverpool-UK.webp`,
  "queens club": `${IMAGE_BASE}HSBC-Championships-Queens-Club.webp`,
  "hsbc championships": `${IMAGE_BASE}HSBC-Championships-Queens-Club.webp`,
  "henley royal regatta": `${IMAGE_BASE}Henley-Royal-Regatta.webp`,
  "henley regatta": `${IMAGE_BASE}Henley-Royal-Regatta.webp`,
  "icc mens t20 world cup": `${IMAGE_BASE}ICC-Mens-T20-World-Cup.webp`,
  "t20 world cup": `${IMAGE_BASE}ICC-Mens-T20-World-Cup.webp`,
  "icc womens t20 world cup": `${IMAGE_BASE}ICC-Womens-T20-World-Cup.webp`,
  "indian wells": `${IMAGE_BASE}Indian-Wells-BNP-Paribas-Open.webp`,
  "bnp paribas open": `${IMAGE_BASE}Indian-Wells-BNP-Paribas-Open.webp`,
  "indianapolis 500": `${IMAGE_BASE}Indianapolis-500.webp`,
  "indy 500": `${IMAGE_BASE}Indianapolis-500.webp`,
  "internazionali ditalia": `${IMAGE_BASE}Internazionali-dItalia-Rome.webp`,
  "italian open": `${IMAGE_BASE}Internazionali-dItalia-Rome.webp`,
  "rome masters": `${IMAGE_BASE}Internazionali-dItalia-Rome.webp`,
  "investec champions cup final": `${IMAGE_BASE}Investec-Champions-Cup-Final.webp`,
  "champions cup final": `${IMAGE_BASE}Investec-Champions-Cup-Final.webp`,
  "isle of man tt": `${IMAGE_BASE}Isle-of-Man-TT.webp`,
  "isle of wight festival": `${IMAGE_BASE}Isle-of-Wight-Festival.webp`,
  "italy vs england six nations": `${IMAGE_BASE}Italy-vs-England-Six-Nations.webp`,
  "jingle bell ball": `${IMAGE_BASE}Jingle-Bell-Ball.webp`,
  "kentucky derby": `${IMAGE_BASE}Kentucky-Derby.webp`,
  "kentucky oaks": `${IMAGE_BASE}Kentucky-Oaks.webp`,
  "king george vi chase": `${IMAGE_BASE}King-George-VI-Chase.webp`,
  "king george vi queen elizabeth stakes": `${IMAGE_BASE}King-George-VI-Queen-Elizabeth-Stakes.webp`,
  "king george": `${IMAGE_BASE}King-George-VI-Queen-Elizabeth-Stakes.webp`,
  "latitude festival": `${IMAGE_BASE}Latitude-Festival.webp`,
  "laver cup": `${IMAGE_BASE}Laver-Cup.webp`,
  "london fashion week": `${IMAGE_BASE}London-Fashion-Week.webp`,
  "london marathon": `${IMAGE_BASE}London-Marathon.webp`,
  "madrid open": `${IMAGE_BASE}Madrid-Open.webp`,
  "melbourne cup": `${IMAGE_BASE}Melbourne-Cup.webp`,
  "met gala": `${IMAGE_BASE}Met-Gala-New-York.webp`,
  "miami open": `${IMAGE_BASE}Miami-Open.webp`,
  "milan fashion week": `${IMAGE_BASE}Milan-Fashion-Week.webp`,
  "winter olympics": `${IMAGE_BASE}Milano-Cortina-2026-Winter-Olympics.webp`,
  "milano cortina": `${IMAGE_BASE}Milano-Cortina-2026-Winter-Olympics.webp`,
  "monaco e prix": `${IMAGE_BASE}Monaco-E-Prix-Formula-E.webp`,
  "monaco historic grand prix": `${IMAGE_BASE}Monaco-Historic-Grand-Prix.webp`,
  "monte carlo masters": `${IMAGE_BASE}Monte-Carlo-Masters.webp`,
  "motogp czech gp": `${IMAGE_BASE}MotoGP-Round-10-Czech-GP.webp`,
  "motogp british gp": `${IMAGE_BASE}MotoGP-Round-13-British-GP.webp`,
  "motogp japanese gp": `${IMAGE_BASE}MotoGP-Round-17-Japanese-GP.webp`,
  "motogp indonesian gp": `${IMAGE_BASE}MotoGP-Round-18-Indonesian-GP.webp`,
  "motogp australian gp": `${IMAGE_BASE}MotoGP-Round-19-Australian-GP.webp`,
  "motogp malaysian gp": `${IMAGE_BASE}MotoGP-Round-20-Malaysian-GP.webp`,
  "motogp portuguese gp": `${IMAGE_BASE}MotoGP-Round-21-Portuguese-GP.webp`,
  "motogp valencia gp": `${IMAGE_BASE}MotoGP-Round-22-Valencia-GP.webp`,
  "motogp spanish gp": `${IMAGE_BASE}MotoGP-Round-5-Spanish-GP.webp`,
  "motogp thailand gp": `${IMAGE_BASE}MotoGP-Thailand-GP.webp`,
  "motogp": `${IMAGE_BASE}MotoGP-Round-13-British-GP.webp`,
  "nba europe games berlin": `${IMAGE_BASE}NBA-Europe-Games-Berlin.webp`,
  "nba europe games london": `${IMAGE_BASE}NBA-Europe-Games-London.webp`,
  "nba europe games": `${IMAGE_BASE}NBA-Europe-Games-London.webp`,
  "nba london": `${IMAGE_BASE}NBA-Europe-Games-London.webp`,
  "nfl playoffs conference championships": `${IMAGE_BASE}NFL-Playoffs-Conference-Championships.webp`,
  "nfl playoffs divisional round": `${IMAGE_BASE}NFL-Playoffs-Divisional-Round.webp`,
  "nfl playoffs wild card": `${IMAGE_BASE}NFL-Playoffs-Wild-Card-Round.webp`,
  "nfl london": `${IMAGE_BASE}nfl-london-games.webp`,
  "nfl london games": `${IMAGE_BASE}nfl-london-games.webp`,
  "nurburgring 24 hours": `${IMAGE_BASE}Nurburgring-24-Hours.webp`,
  "nurburgring": `${IMAGE_BASE}Nurburgring-24-Hours.webp`,
  "oktoberfest": `${IMAGE_BASE}Oktoberfest.webp`,
  "olivier awards": `${IMAGE_BASE}Olivier-Awards.webp`,
  "pdc world darts championship": `${IMAGE_BASE}PDC-World-Darts-Championship.webp`,
  "world darts championship": `${IMAGE_BASE}PDC-World-Darts-Championship.webp`,
  "world darts": `${IMAGE_BASE}PDC-World-Darts-Championship.webp`,
  "pga championship": `${IMAGE_BASE}PGA-Championship.webp`,
  "palio di siena": `${IMAGE_BASE}Palio-di-Siena-Summer.webp`,
  "paris fashion week": `${IMAGE_BASE}Paris-Fashion-Week.webp`,
  "paris haute couture": `${IMAGE_BASE}Paris-Haute-Couture-Week.webp`,
  "paris mens fashion week": `${IMAGE_BASE}paris-mens-fashion-week-2026.webp`,
  "parklife festival": `${IMAGE_BASE}Parklife-Festival.webp`,
  "parklife": `${IMAGE_BASE}Parklife-Festival.webp`,
  "premier league opening weekend": `${IMAGE_BASE}Premier-League-2026_27-Opening-Weekend.webp`,
  "premier league boxing day": `${IMAGE_BASE}Premier-League-Boxing-Day-Fixtures.webp`,
  "premier league darts final": `${IMAGE_BASE}Premier-League-Darts-Final.webp`,
  "premier league darts": `${IMAGE_BASE}Premier-League-Darts-Final.webp`,
  "premier league final round": `${IMAGE_BASE}Premier-League-Final-Round.webp`,
  "premier league final day": `${IMAGE_BASE}Premier-League-Final-Round.webp`,
  "presidents cup": `${IMAGE_BASE}Presidents-Cup.webp`,
  "prix de larc de triomphe": `${IMAGE_BASE}Prix-de-lArc-de-Triomphe-Weekend.webp`,
  "arc de triomphe": `${IMAGE_BASE}Prix-de-lArc-de-Triomphe-Weekend.webp`,
  "qatar goodwood festival": `${IMAGE_BASE}Qatar-Goodwood-Festival.webp`,
  "raye": `${IMAGE_BASE}RAYE-This-Tour-May-Contain-New-Music.webp`,
  "reading leeds": `${IMAGE_BASE}Reading-Leeds-Festivals.webp`,
  "reading festival": `${IMAGE_BASE}Reading-Leeds-Festivals.webp`,
  "leeds festival": `${IMAGE_BASE}Reading-Leeds-Festivals.webp`,
  "rolex 24 at daytona": `${IMAGE_BASE}Rolex-24-At-Daytona.webp`,
  "daytona 24": `${IMAGE_BASE}Rolex-24-At-Daytona.webp`,
  "royal ascot": `${IMAGE_BASE}Royal-Ascot.webp`,
  "ascot": `${IMAGE_BASE}Royal-Ascot.webp`,
  "sailgp": `${IMAGE_BASE}SailGP-UK-Plymouth.webp`,
  "sailgp uk plymouth": `${IMAGE_BASE}SailGP-UK-Plymouth.webp`,
  "six nations championship": `${IMAGE_BASE}Six-Nations-Championship.webp`,
  "six nations": `${IMAGE_BASE}Six-Nations-Championship.webp`,
  "six nations super saturday": `${IMAGE_BASE}Six-Nations-Super-Saturday-Finale.webp`,
  "solheim cup": `${IMAGE_BASE}Solheim-Cup.webp`,
  "st leger festival": `${IMAGE_BASE}St-Leger-Festival.webp`,
  "st leger": `${IMAGE_BASE}St-Leger-Festival.webp`,
  "sundance film festival": `${IMAGE_BASE}Sundance-film-festival.webp`,
  "sundance": `${IMAGE_BASE}Sundance-film-festival.webp`,
  "super bowl": `${IMAGE_BASE}Super-Bowl-LX.webp`,
  "t20 blast finals day": `${IMAGE_BASE}T20-Blast-Finals-Day.webp`,
  "t20 blast": `${IMAGE_BASE}T20-Blast-Finals-Day.webp`,
  "tefaf maastricht": `${IMAGE_BASE}TEFAF-Maastricht.webp`,
  "tefaf": `${IMAGE_BASE}TEFAF-Maastricht.webp`,
  "trnsmt festival": `${IMAGE_BASE}TRNSMT-Festival.webp`,
  "trnsmt": `${IMAGE_BASE}TRNSMT-Festival.webp`,
  "take that": `${IMAGE_BASE}Take-That-The-Circus-Live-Tour.webp`,
  "the open championship": `${IMAGE_BASE}The-154th-Open-Championship.webp`,
  "the open": `${IMAGE_BASE}The-154th-Open-Championship.webp`,
  "open championship": `${IMAGE_BASE}The-154th-Open-Championship.webp`,
  "the hundred": `${IMAGE_BASE}The-Hundred.webp`,
  "the masters": `${IMAGE_BASE}The-Masters.webp`,
  "masters golf": `${IMAGE_BASE}The-Masters.webp`,
  "the players championship": `${IMAGE_BASE}The-Players-Championship.webp`,
  "players championship": `${IMAGE_BASE}The-Players-Championship.webp`,
  "tomorrowland": `${IMAGE_BASE}Tomorrowland.webp`,
  "tour de france": `${IMAGE_BASE}Tour-de-France.webp`,
  "champions league final": `${IMAGE_BASE}UEFA-Champions-League-Final.webp`,
  "uefa champions league final": `${IMAGE_BASE}UEFA-Champions-League-Final.webp`,
  "europa conference league final": `${IMAGE_BASE}UEFA-Europa-Conference-League-Final.webp`,
  "europa league final": `${IMAGE_BASE}UEFA-Europa-League-Final.webp`,
  "uefa super cup": `${IMAGE_BASE}UEFA-Super-Cup.webp`,
  "womens champions league final": `${IMAGE_BASE}UEFA-Womens-Champions-League-Final.webp`,
  "ufc": `${IMAGE_BASE}UFC-White-House.webp`,
  "us open": `${IMAGE_BASE}US-Open.webp`,
  "venice film festival": `${IMAGE_BASE}Venice-Film-Festival.webp`,
  "vuelta a espana": `${IMAGE_BASE}Vuelta-a-Espana.webp`,
  "vuelta": `${IMAGE_BASE}Vuelta-a-Espana.webp`,
  "wta finals": `${IMAGE_BASE}WTA-Finals.webp`,
  "white turf st moritz": `${IMAGE_BASE}White-Turf-St.-Moritz-Race-Day-1.webp`,
  "st moritz": `${IMAGE_BASE}White-Turf-St.-Moritz-Race-Day-1.webp`,
  "wimbledon championships": `${IMAGE_BASE}Wimbledon-Championships.webp`,
  "wimbledon": `${IMAGE_BASE}Wimbledon-Championships.webp`,
  "wimbledon gentlemans final": `${IMAGE_BASE}Wimbledon-Gentlemans-Final.webp`,
  "wimbledon final": `${IMAGE_BASE}Wimbledon-Gentlemans-Final.webp`,
  "winter paralympics": `${IMAGE_BASE}Winter-Paralympics-2026.webp`,
  "paralympics": `${IMAGE_BASE}Winter-Paralympics-2026.webp`,
  "wireless festival": `${IMAGE_BASE}Wireless-Festival.webp`,
  "wireless": `${IMAGE_BASE}Wireless-Festival.webp`,
  "world athletics u20 championships": `${IMAGE_BASE}World-Athletics-U20-Championships.webp`,
  "world rowing championships": `${IMAGE_BASE}World-Rowing-Championships.webp`,
  "york ebor festival": `${IMAGE_BASE}York-Ebor-Festival.webp`,
  "ebor festival": `${IMAGE_BASE}York-Ebor-Festival.webp`,
  "burning man": `${IMAGE_BASE}burning-man-festival.webp`,
  "dakar rally": `${IMAGE_BASE}dakar-ralley.webp`,
  "dakar": `${IMAGE_BASE}dakar-ralley.webp`,
  "new york fashion week": `${IMAGE_BASE}new-york-fashion-week.webp`,
  "glastonbury": `${IMAGE_BASE}Creamfields.webp`,
  "marbella golf": `${IMAGE_BASE}BMW-PGA-Championship.webp`,
  "golf trip": `${IMAGE_BASE}BMW-PGA-Championship.webp`,
  "skiing": `${IMAGE_BASE}Milano-Cortina-2026-Winter-Olympics.webp`,
  "ski trip": `${IMAGE_BASE}Milano-Cortina-2026-Winter-Olympics.webp`,
};

function resolveEventImage(eventName: string): string | null {
  if (!eventName) return null;
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[''`]/g, "'").replace(/[^\w\s']/g, " ").replace(/\s+/g, " ").trim();
  const normalized = normalize(eventName);
  if (IMAGE_LIBRARY[normalized]) return IMAGE_LIBRARY[normalized];
  const noYear = normalized.replace(/\b20\d{2}(\/\d{2})?\b/g, "").replace(/\b\d{2}\/\d{2}\b/g, "").replace(/\s+/g, " ").trim();
  if (noYear !== normalized && IMAGE_LIBRARY[noYear]) return IMAGE_LIBRARY[noYear];
  const keys = Object.keys(IMAGE_LIBRARY);
  const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) { if (key.length >= 4 && normalized.includes(key)) return IMAGE_LIBRARY[key]; }
  for (const key of sortedKeys) { if (key.length >= 4 && noYear.includes(key)) return IMAGE_LIBRARY[key]; }
  for (const key of sortedKeys) { if (key.length >= 6 && key.includes(noYear)) return IMAGE_LIBRARY[key]; }
  const eventWords = noYear.split(" ").filter((w) => w.length >= 3);
  if (eventWords.length >= 2) {
    let bestMatch: string | null = null;
    let bestScore = 0;
    for (const key of sortedKeys) {
      const matchingWords = eventWords.filter((w) => key.includes(w));
      const score = matchingWords.length / eventWords.length;
      if (score > bestScore && matchingWords.length >= 2) { bestScore = score; bestMatch = key; }
    }
    if (bestMatch && bestScore >= 0.4) return IMAGE_LIBRARY[bestMatch];
  }
  return null;
}

// ── Category Visual System ──

const CATEGORY_VISUALS: Record<
  string,
  { gradient: string; icon: React.ComponentType<{ className?: string; weight?: "fill" | "regular" | "bold" | "light" | "thin" | "duotone" }>; accent: string }
> = {
  "formula 1": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "formula-1": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "f1": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "f1 driving experience": { gradient: "from-red-950 via-red-900 to-red-800", icon: FlagCheckered, accent: "text-red-400" },
  "motor racing": { gradient: "from-red-950 via-red-900/80 to-zinc-900", icon: FlagCheckered, accent: "text-red-400" },
  "motorsport": { gradient: "from-red-950 via-red-900/80 to-zinc-900", icon: FlagCheckered, accent: "text-red-400" },
  "tennis": { gradient: "from-green-950 via-green-900 to-emerald-900", icon: TennisBall, accent: "text-green-400" },
  "rugby": { gradient: "from-violet-950 via-violet-900 to-purple-900", icon: Football, accent: "text-violet-400" },
  "football": { gradient: "from-emerald-950 via-emerald-900 to-green-900", icon: Football, accent: "text-emerald-400" },
  "golf": { gradient: "from-teal-950 via-teal-900 to-cyan-900", icon: Flag, accent: "text-teal-400" },
  "cricket": { gradient: "from-lime-950 via-lime-900 to-green-900", icon: Trophy, accent: "text-lime-400" },
  "horse racing": { gradient: "from-amber-950 via-amber-900 to-yellow-900", icon: Horse, accent: "text-amber-400" },
  "horse-racing": { gradient: "from-amber-950 via-amber-900 to-yellow-900", icon: Horse, accent: "text-amber-400" },
  "boxing": { gradient: "from-rose-950 via-rose-900 to-red-900", icon: Lightning, accent: "text-rose-400" },
  "combat sports": { gradient: "from-rose-950 via-rose-900 to-red-900", icon: Lightning, accent: "text-rose-400" },
  "darts": { gradient: "from-orange-950 via-orange-900 to-amber-900", icon: Star, accent: "text-orange-400" },
  "live music": { gradient: "from-pink-950 via-pink-900 to-fuchsia-900", icon: MusicNote, accent: "text-pink-400" },
  "live-music": { gradient: "from-pink-950 via-pink-900 to-fuchsia-900", icon: MusicNote, accent: "text-pink-400" },
  "music": { gradient: "from-pink-950 via-pink-900 to-fuchsia-900", icon: MusicNote, accent: "text-pink-400" },
  "glastonbury": { gradient: "from-fuchsia-950 via-fuchsia-900 to-purple-900", icon: MusicNote, accent: "text-fuchsia-400" },
  "festival": { gradient: "from-fuchsia-950 via-fuchsia-900 to-purple-900", icon: MusicNote, accent: "text-fuchsia-400" },
  "theatre": { gradient: "from-fuchsia-950 via-fuchsia-900 to-rose-900", icon: Star, accent: "text-fuchsia-400" },
  "theatre/ performing arts": { gradient: "from-fuchsia-950 via-fuchsia-900 to-rose-900", icon: Star, accent: "text-fuchsia-400" },
  "fashion": { gradient: "from-pink-950 via-pink-900 to-rose-900", icon: Star, accent: "text-pink-400" },
  "culinary": { gradient: "from-orange-950 via-orange-900 to-amber-900", icon: ForkKnife, accent: "text-orange-400" },
  "luxury": { gradient: "from-purple-950 via-purple-900 to-violet-900", icon: Star, accent: "text-purple-400" },
  "luxury/lifestyle/celebrity": { gradient: "from-purple-950 via-purple-900 to-violet-900", icon: Star, accent: "text-purple-400" },
  "luxury skiing": { gradient: "from-sky-950 via-sky-900 to-blue-900", icon: Star, accent: "text-sky-400" },
  "nfl": { gradient: "from-blue-950 via-blue-900 to-indigo-900", icon: Football, accent: "text-blue-400" },
  "american sports": { gradient: "from-blue-950 via-blue-900 to-indigo-900", icon: Football, accent: "text-blue-400" },
  "basketball": { gradient: "from-orange-950 via-orange-900/80 to-zinc-900", icon: Trophy, accent: "text-orange-400" },
  "rowing/sailing": { gradient: "from-cyan-950 via-cyan-900 to-blue-900", icon: Flag, accent: "text-cyan-400" },
  "sailing": { gradient: "from-cyan-950 via-cyan-900 to-blue-900", icon: Flag, accent: "text-cyan-400" },
  "rowing": { gradient: "from-blue-950 via-blue-900 to-cyan-900", icon: Flag, accent: "text-blue-400" },
  "redbull factory tour": { gradient: "from-blue-950 via-indigo-900 to-zinc-900", icon: Lightning, accent: "text-blue-400" },
  "orient express": { gradient: "from-amber-950 via-amber-900/80 to-zinc-900", icon: Star, accent: "text-amber-400" },
  "awards": { gradient: "from-amber-950 via-amber-900 to-yellow-900", icon: Trophy, accent: "text-amber-400" },
  "athletics": { gradient: "from-blue-950 via-blue-900 to-sky-900", icon: TrendUp, accent: "text-blue-400" },
  "cycling": { gradient: "from-yellow-950 via-yellow-900 to-amber-900", icon: Timer, accent: "text-yellow-400" },
  "formula e": { gradient: "from-sky-950 via-sky-900 to-blue-900", icon: Lightning, accent: "text-sky-400" },
  "formula-e": { gradient: "from-sky-950 via-sky-900 to-blue-900", icon: Lightning, accent: "text-sky-400" },
  "art": { gradient: "from-indigo-950 via-indigo-900 to-violet-900", icon: Star, accent: "text-indigo-400" },
  "film": { gradient: "from-indigo-950 via-indigo-900 to-violet-900", icon: Star, accent: "text-indigo-400" },
  "multi-sport": { gradient: "from-sky-950 via-sky-900 to-indigo-900", icon: Trophy, accent: "text-sky-400" },
};

function getCategoryVisual(category: string | null) {
  if (!category) return { gradient: "from-zinc-900 via-zinc-800 to-zinc-700", icon: CalendarBlank, accent: "text-muted-foreground" };
  const key = category.toLowerCase();
  return CATEGORY_VISUALS[key] || CATEGORY_VISUALS[key.replace(/\s+/g, "-")] || { gradient: "from-zinc-900 via-zinc-800 to-zinc-700", icon: CalendarBlank, accent: "text-zinc-400" };
}

function getCatStyle(category: string | null) {
  if (!category) return { bg: "bg-muted/15", text: "text-muted-foreground" };
  const key = category.toLowerCase().replace(/\s+/g, "-");
  return EVENT_CATEGORY_COLORS[key] || EVENT_CATEGORY_COLORS[category.toLowerCase()] || { bg: "bg-muted/15", text: "text-muted-foreground" };
}

// ── Helpers ──

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (!e || s.toDateString() === e.toDateString()) return s.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
  return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const parts = time.split(":");
  return `${parts[0]}:${parts[1]}`;
}

// ── Ticket Types ──

const TICKET_TYPES = [
  { label: "Event", icon: Ticket, requiredField: "Event_Tickets_Required__c", bookedField: "Event_Tickets_Booked__c" },
  { label: "Hospitality", icon: Package, requiredField: "Hospitality_Tickets_Required__c", bookedField: "Hospitality_Tickets_Booked__c" },
  { label: "Hotel", icon: Bed, requiredField: "Hotel_Tickets_Required__c", bookedField: "Hotel_Tickets_Booked__c" },
  { label: "Dinner", icon: ForkKnife, requiredField: "Dinner_Tickets_Required__c", bookedField: "Dinner_Tickets_Booked__c" },
  { label: "Drinks", icon: Martini, requiredField: "Drinks_Tickets_Required__c", bookedField: "Drinks_Tickets_Booked__c" },
  { label: "Party", icon: Confetti, requiredField: "Party_Tickets_Required__c", bookedField: "Party_Tickets_Booked__c" },
  { label: "Flights In", icon: AirplaneLanding, requiredField: "Inbound_Flight_Tickets_Required__c", bookedField: "Inbound_Flight_Tickets_Booked__c" },
  { label: "Flights Out", icon: AirplaneTakeoff, requiredField: "Outbound_Flight_Tickets_Required__c", bookedField: "Outbound_Flight_Tickets_Booked__c" },
  { label: "Transfers In", icon: Car, requiredField: "Inbound_Transfer_Tickets_Required__c", bookedField: "Inbound_Transfer_Tickets_Booked__c" },
  { label: "Transfers Out", icon: Car, requiredField: "Outbound_Transfer_Tickets_Required__c", bookedField: "Outbound_Transfer_Tickets_Booked__c" },
] as const;

// ── Ticket Bar ──

function TicketBar({ label, icon: Icon, required, booked }: { label: string; icon: React.ComponentType<{ className?: string }>; required: number; booked: number }) {
  if (required === 0) return null;
  const pct = Math.min(100, Math.round((booked / required) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="w-20 truncate text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right tabular-nums text-muted-foreground">{booked}/{required}</span>
      {pct >= 80 && <Warning className="size-3.5 text-amber-400 shrink-0" weight="fill" />}
    </div>
  );
}

// ── Event Card — premium, zero-shift design ──

function EventCard({ event, onClick }: { event: SalesforceEvent; onClick: () => void }) {
  const catVisual = getCategoryVisual(event.Category__c);
  const CatIcon = catVisual.icon;
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const imageUrl = event.Event_Image_1__c || resolveEventImage(event.Name);
  const startDate = event.Start_Date__c ? new Date(event.Start_Date__c) : null;

  return (
    <div
      onClick={onClick}
      className={`ab-card group cursor-pointer relative overflow-hidden rounded-xl ${isPast ? "opacity-40 hover:opacity-60" : ""}`}
      style={{ aspectRatio: "3/4" }}
    >
      {/* Image or gradient background — always positioned absolutely */}
      {imageUrl ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover will-change-transform transition-[transform,opacity] duration-700 ease-out opacity-85 group-hover:opacity-100 group-hover:scale-[1.04]"
            loading="lazy"
          />
          {/* Single clean gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0">
          <div className={`absolute inset-0 bg-gradient-to-br ${catVisual.gradient}`} />
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]">
            <CatIcon className="size-48" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      )}

      {/* Card content — fixed layout, no shifting */}
      <div className="relative z-[2] h-full flex flex-col justify-between p-5">
        {/* Top row: date + category */}
        <div className="flex items-start justify-between">
          {startDate ? (
            <div className="flex flex-col pl-2.5 border-l border-white/80">
              <span className="text-[22px] font-light text-white leading-none tabular-nums">{startDate.getDate()}</span>
              <span className="text-[10px] font-bold tracking-[0.1em] text-white/70 mt-1 uppercase">
                {startDate.toLocaleDateString("en-GB", { month: "short" })}
              </span>
            </div>
          ) : (
            <div />
          )}
          <span className="text-[8px] font-bold tracking-[0.12em] uppercase text-white/90 px-1.5 py-[3px] rounded-[3px] border border-white/20 backdrop-blur-sm bg-black/10">
            {event.Category__c || "Event"}
          </span>
        </div>

        {/* Bottom: title, location, arrow — always laid out, opacity transitions only */}
        <div>
          {/* Title — always visible */}
          <h3 className="text-white font-light leading-[1.12] line-clamp-3 text-[clamp(17px,1.8vw,24px)] mb-2">
            {event.Name}
          </h3>

          {/* Meta row — always occupies space, fades in on hover */}
          <div className="flex items-end justify-between pt-2.5 border-t border-white/[0.12] opacity-0 group-hover:opacity-100 transition-opacity duration-400 ease-out">
            <div className="min-w-0 flex-1">
              {event.Location__r?.Name ? (
                <>
                  <div className="text-[9px] tracking-[0.14em] text-white/35 mb-0.5 uppercase">Location</div>
                  <div className="text-[12px] font-light text-white/80 truncate">{event.Location__r.Name}</div>
                </>
              ) : (
                <>
                  <div className="text-[9px] tracking-[0.14em] text-white/35 mb-0.5 uppercase">Date</div>
                  <div className="text-[12px] font-light text-white/80">{formatDateRange(event.Start_Date__c, event.End_Date__c)}</div>
                </>
              )}
            </div>
            <div className="size-7 rounded-full bg-white flex items-center justify-center shrink-0 ml-3">
              <CaretRight className="size-3 text-black" weight="bold" />
            </div>
          </div>
        </div>
      </div>

      {/* Card border glow — CSS-only, no JS handlers */}
      <style jsx>{`
        .ab-card {
          border: 1px solid rgba(255,255,255,0.05);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          transition: border-color 0.5s ease, box-shadow 0.4s ease;
        }
        .ab-card:hover {
          border-color: rgba(255,255,255,0.14);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 12px 28px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}

// ── Full-Screen Event Detail ──

// Extract client name from opp name (e.g., "John Smith - Company LTD-003440" → "John Smith")
function clientName(oppName: string): string {
  const dashIdx = oppName.indexOf(" - ");
  return dashIdx > 0 ? oppName.slice(0, dashIdx) : oppName;
}

function EventDetail({ event, onClose }: { event: SalesforceEvent; onClose: () => void }) {
  const [opportunities, setOpportunities] = useState<SalesforceOpportunityFull[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "deals" | "financials">("overview");

  useEffect(() => {
    const fetchOpps = async () => {
      try {
        const res = await fetch(`/api/events/inventory/${event.Id}`);
        const data = await res.json();
        if (data.success) setOpportunities(data.data);
      } catch (e) { console.error("Failed to load event opportunities", e); }
      finally { setOppsLoading(false); }
    };
    fetchOpps();
  }, [event.Id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handler); };
  }, [onClose]);

  const catVisual = getCategoryVisual(event.Category__c);
  const CatIcon = catVisual.icon;
  const daysLeft = event.Start_Date__c ? daysUntil(event.Start_Date__c) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const revenueTarget = event.Revenue_Target__c || 0;
  const revenueActual = event.Sum_of_Closed_Won_Gross__c || 0;
  const revenuePct = revenueTarget > 0 ? Math.min(100, Math.round((revenueActual / revenueTarget) * 100)) : 0;
  const margin = event.Margin_Percentage__c;
  const totalBooked = event.Total_Tickets_Booked__c || 0;
  const totalRequired = event.Total_Tickets_Required__c || 0;
  const completionPct = event.Percentage_Reservations_Completion__c || 0;
  const sfImages = [event.Event_Image_1__c, event.Event_Image_2__c, event.Event_Image_3__c, event.Event_Image_4__c, event.Event_Image_5__c].filter(Boolean) as string[];
  const resolvedImage = sfImages.length === 0 ? resolveEventImage(event.Name) : null;
  const images = sfImages.length > 0 ? sfImages : resolvedImage ? [resolvedImage] : [];
  const totalCosts = (event.Total_Booking_Cost__c || 0) + (event.Total_Staff_Costs__c || 0);

  const oppsByStage = useMemo(() => {
    const grouped: Record<string, SalesforceOpportunityFull[]> = {};
    for (const opp of opportunities) { if (!grouped[opp.StageName]) grouped[opp.StageName] = []; grouped[opp.StageName].push(opp); }
    return grouped;
  }, [opportunities]);
  const totalOppRevenue = useMemo(() => opportunities.reduce((sum, o) => sum + (o.Gross_Amount__c || o.Amount || 0), 0), [opportunities]);
  const wonOpps = useMemo(() => opportunities.filter((o) => ["Agreement Signed", "Amended", "Amendment Signed"].includes(o.StageName)), [opportunities]);

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "tickets" as const, label: "Tickets" },
    { id: "deals" as const, label: `Deals` },
    { id: "financials" as const, label: "Financials" },
  ];

  // Payment progress helper
  const paymentPct = (pct: number | null) => {
    if (pct == null) return null;
    const p = Math.round(pct);
    if (p >= 100) return { label: "Paid", color: "text-emerald-400" };
    if (p >= 50) return { label: `${p}%`, color: "text-foreground/70" };
    if (p > 0) return { label: `${p}%`, color: "text-amber-400/80" };
    return { label: "0%", color: "text-muted-foreground/50" };
  };

  // Group deals into won vs lost for side-by-side layout
  const wonStages = ["Agreement Signed", "Amended", "Amendment Signed"];
  const lostStages = ["Closed Lost"];
  const wonDeals = useMemo(() => opportunities.filter((o) => wonStages.includes(o.StageName)), [opportunities]);
  const lostDeals = useMemo(() => opportunities.filter((o) => lostStages.includes(o.StageName)), [opportunities]);
  const otherDeals = useMemo(() => opportunities.filter((o) => !wonStages.includes(o.StageName) && !lostStages.includes(o.StageName)), [opportunities]);
  const wonTotal = useMemo(() => wonDeals.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0), [wonDeals]);
  const lostTotal = useMemo(() => lostDeals.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0), [lostDeals]);

  // Embossed card style — reusable
  const cardCls = "rounded-xl border border-white/[0.06] bg-white/[0.025]";
  const cardShadow = { boxShadow: "0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.03)" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-stretch justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl m-6 bg-card rounded-2xl border border-border/40 overflow-hidden flex flex-col"
        style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Hero — compact with stronger fade */}
        <div className="relative h-52 shrink-0 overflow-hidden">
          {images.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/image-proxy?url=${encodeURIComponent(images[0])}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-black/20" />
            </>
          ) : (
            <>
              <div className={`absolute inset-0 bg-gradient-to-br ${catVisual.gradient}`} />
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]"><CatIcon className="size-56" /></div>
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            </>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 z-10 size-8 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition-colors">
            <X className="size-3.5" weight="bold" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/80 px-1.5 py-[2px] rounded-[3px] border border-white/15 backdrop-blur-sm bg-black/10">
                {event.Category__c || "Event"}
              </span>
              {daysLeft !== null && (
                <span className={`text-[10px] font-medium ${isPast ? "text-muted-foreground/60" : daysLeft <= 14 ? "text-amber-400/80" : "text-white/40"}`}>
                  {isPast ? "Passed" : `${daysLeft}d away`}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground leading-tight">{event.Name}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-[12px] text-muted-foreground">
              {event.Location__r?.Name && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{event.Location__r.Name}</span>}
              <span className="flex items-center gap-1"><CalendarBlank className="size-3.5" />{formatDateRange(event.Start_Date__c, event.End_Date__c)}</span>
              {event.Owner?.Name && <span className="flex items-center gap-1"><UserCircle className="size-3.5" />{event.Owner.Name}</span>}
            </div>
          </div>
        </div>

        {/* Tabs — clean underline */}
        <div className="border-b border-border/30 px-6">
          <div className="flex items-center gap-0">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground/60 hover:text-muted-foreground"}`}>
                {tab.label}
                {tab.id === "deals" && !oppsLoading && opportunities.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground/40 tabular-nums">{opportunities.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "overview" && (
            <div className="p-6 space-y-4">
              {/* Financials strip — embossed horizontal row */}
              <div className={`flex items-stretch gap-px rounded-xl overflow-hidden ${cardCls}`} style={cardShadow}>
                {[
                  { label: "Pipeline", value: totalOppRevenue, loading: oppsLoading },
                  { label: "Revenue", value: revenueActual, sub: revenueTarget > 0 ? `${revenuePct}% of target` : undefined },
                  { label: "Payments", value: event.Total_Payments_Received__c || 0 },
                  { label: "Costs", value: totalCosts },
                  { label: "Margin", value: margin != null ? null : null, custom: margin != null ? `${margin.toFixed(1)}%` : "—" },
                ].map((item, i) => (
                  <div key={item.label} className={`flex-1 px-4 py-3.5 ${i > 0 ? "border-l border-white/[0.04]" : ""}`}>
                    <div className="text-[10px] text-muted-foreground/50 font-medium tracking-wide uppercase mb-1">{item.label}</div>
                    <div className="text-[15px] font-bold tabular-nums tracking-tight">
                      {item.loading ? "…" : item.custom || formatCurrency(item.value || 0)}
                    </div>
                    {item.sub && <div className="text-[10px] text-muted-foreground/40 mt-0.5">{item.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Two-column: Info + Tickets summary */}
              <div className="grid grid-cols-5 gap-4">
                {/* Left: description + team */}
                <div className="col-span-3 space-y-4">
                  <div className={`${cardCls} p-4`} style={cardShadow}>
                    <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium mb-2.5">About</h4>
                    {event.Description__c ? <p className="text-[13px] text-muted-foreground/80 leading-relaxed">{event.Description__c}</p>
                     : event.Event_Notes__c ? <p className="text-[13px] text-muted-foreground/80 leading-relaxed">{event.Event_Notes__c}</p>
                     : <p className="text-[13px] text-muted-foreground/30 italic">No description available</p>}
                  </div>
                  {/* Team row */}
                  {(event.Owner?.Name || event.A_B_On_Site_1__c || event.Total_Projects__c != null) && (
                    <div className="flex items-center gap-4 text-[12px] px-1">
                      {event.Owner?.Name && (
                        <div className="flex items-center gap-1.5 text-muted-foreground/60">
                          <UserCircle className="size-3.5" /><span>{event.Owner.Name}</span>
                        </div>
                      )}
                      {(event.A_B_On_Site_1__c || event.A_B_On_Site_2__c) && (
                        <div className="text-muted-foreground/40">
                          On-site: {[event.A_B_On_Site_1__c, event.A_B_On_Site_2__c].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {event.Total_Projects__c != null && (
                        <div className="text-muted-foreground/40">{event.Total_Projects__c} projects</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: ticket summary */}
                <div className={`col-span-2 ${cardCls} p-4`} style={cardShadow}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium">Tickets</h4>
                    <span className="text-[12px] tabular-nums font-semibold">{totalBooked}<span className="text-muted-foreground/30 font-normal">/{totalRequired}</span></span>
                  </div>
                  <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${completionPct >= 90 ? "bg-red-400/80" : completionPct >= 50 ? "bg-amber-400/70" : "bg-emerald-400/70"}`} style={{ width: `${completionPct}%` }} />
                  </div>
                  <div className="space-y-1.5">
                    {TICKET_TYPES.map((tt) => {
                      const req = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0;
                      const bkd = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0;
                      if (req === 0) return null;
                      const pct = Math.round((bkd / req) * 100);
                      return (
                        <div key={tt.label} className="flex items-center gap-2 text-[11px]">
                          <span className="w-16 text-muted-foreground/50 truncate">{tt.label}</span>
                          <div className="flex-1 h-1 bg-muted/15 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400/60" : pct >= 50 ? "bg-amber-400/50" : "bg-emerald-400/50"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right tabular-nums text-muted-foreground/40">{bkd}/{req}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Deal pipeline — embossed with proper sizing */}
              {!oppsLoading && opportunities.length > 0 && (
                <div className={`${cardCls} p-4`} style={cardShadow}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium">Pipeline</h4>
                    <span className="text-[11px] text-muted-foreground/40 tabular-nums">{opportunities.length} deals · {formatCurrency(totalOppRevenue)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 h-9 mb-3">
                    {Object.entries(oppsByStage).map(([stage, opps]) => {
                      const sc = OPPORTUNITY_STAGES[stage];
                      const st = opps.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0);
                      const wp = totalOppRevenue > 0 ? Math.max(8, (st / totalOppRevenue) * 100) : 100 / Object.keys(oppsByStage).length;
                      return (
                        <div key={stage} className={`h-full rounded-lg flex items-center justify-center ${sc?.bgColor || "bg-muted/20 text-muted-foreground"}`} style={{ flex: wp }} title={`${stage}: ${opps.length} · ${formatCurrency(st)}`}>
                          <span className="text-[11px] font-semibold truncate px-2">{opps.length}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4">
                    {Object.entries(oppsByStage).map(([stage, opps]) => {
                      const sc = OPPORTUNITY_STAGES[stage];
                      const st = opps.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0);
                      return (
                        <div key={stage} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
                          <div className={`size-2 rounded-full ${sc?.bgColor?.replace("text-", "bg-") || "bg-muted/30"}`} style={{ backgroundColor: sc?.bgColor ? undefined : "rgba(255,255,255,0.1)" }} />
                          <span className="font-medium">{stage}</span>
                          <span className="text-muted-foreground/30 tabular-nums">{opps.length} · {formatCurrency(st)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "tickets" && (
            <div className="p-6 space-y-4">
              <div className={`${cardCls} p-5`} style={cardShadow}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium">Ticket Inventory</h4>
                  <span className="text-sm tabular-nums font-bold">{totalBooked}/{totalRequired} <span className="text-muted-foreground/50 font-normal">({Math.round(completionPct)}%)</span></span>
                </div>
                <div className="h-2 bg-muted/15 rounded-full overflow-hidden mb-5">
                  <div className={`h-full rounded-full transition-all ${completionPct >= 90 ? "bg-red-400/80" : completionPct >= 70 ? "bg-amber-400/70" : "bg-emerald-400/70"}`} style={{ width: `${completionPct}%` }} />
                </div>
                <div className="space-y-2.5">
                  {TICKET_TYPES.map((tt) => {
                    const req = (event[tt.requiredField as keyof SalesforceEvent] as number | null) || 0;
                    const bkd = (event[tt.bookedField as keyof SalesforceEvent] as number | null) || 0;
                    return <TicketBar key={tt.label} label={tt.label} icon={tt.icon} required={req} booked={bkd} />;
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "deals" && (
            <div className="p-6">
              {oppsLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/10 animate-pulse" />)}</div>
              ) : opportunities.length === 0 ? (
                <p className="text-center text-muted-foreground/50 py-16 text-sm">No deals linked to this event</p>
              ) : (
                <div className="space-y-5">
                  {/* Won + Lost side by side */}
                  {(wonDeals.length > 0 || lostDeals.length > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Won column */}
                      <div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="size-3.5 text-emerald-400/80" weight="fill" />
                            <span className="text-[12px] font-semibold text-emerald-400/80">Won</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground/30 tabular-nums">{wonDeals.length} · {formatCurrency(wonTotal)}</span>
                        </div>
                        <div className="space-y-2">
                          {wonDeals.length > 0 ? wonDeals.map((opp) => {
                            const amount = opp.Gross_Amount__c || opp.Amount || 0;
                            const pp = paymentPct(opp.Percentage_Paid__c);
                            return (
                              <div key={opp.Id} className={`${cardCls} p-3.5`} style={cardShadow}>
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <span className="text-[13px] font-semibold truncate">{clientName(opp.Name)}</span>
                                  <span className="text-[13px] font-bold tabular-nums shrink-0">{formatCurrency(amount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-muted-foreground/40 truncate">
                                    {opp.Account?.Name}{opp.Owner?.Name && ` · ${opp.Owner.Name}`}
                                  </span>
                                  {pp && <span className={`text-[10px] font-medium tabular-nums ${pp.color}`}>{pp.label}</span>}
                                </div>
                              </div>
                            );
                          }) : (
                            <div className={`${cardCls} p-4 text-center`} style={cardShadow}>
                              <span className="text-[12px] text-muted-foreground/25">No won deals</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lost column */}
                      <div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex items-center gap-1.5">
                            <X className="size-3.5 text-red-400/70" weight="bold" />
                            <span className="text-[12px] font-semibold text-red-400/70">Lost</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground/30 tabular-nums">{lostDeals.length} · {formatCurrency(lostTotal)}</span>
                        </div>
                        <div className="space-y-2">
                          {lostDeals.length > 0 ? lostDeals.map((opp) => {
                            const amount = opp.Gross_Amount__c || opp.Amount || 0;
                            const pp = paymentPct(opp.Percentage_Paid__c);
                            return (
                              <div key={opp.Id} className={`${cardCls} p-3.5`} style={cardShadow}>
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <span className="text-[13px] font-semibold truncate">{clientName(opp.Name)}</span>
                                  <span className="text-[13px] font-bold tabular-nums shrink-0">{formatCurrency(amount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-muted-foreground/40 truncate">
                                    {opp.Account?.Name}{opp.Owner?.Name && ` · ${opp.Owner.Name}`}
                                  </span>
                                  {pp && <span className={`text-[10px] font-medium tabular-nums ${pp.color}`}>{pp.label}</span>}
                                </div>
                              </div>
                            );
                          }) : (
                            <div className={`${cardCls} p-4 text-center`} style={cardShadow}>
                              <span className="text-[12px] text-muted-foreground/25">No lost deals</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Other stages (in progress, etc.) — full width below */}
                  {otherDeals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-blue-400/70" />
                          <span className="text-[12px] font-semibold text-blue-400/70">In Progress</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground/30 tabular-nums">
                          {otherDeals.length} · {formatCurrency(otherDeals.reduce((s, o) => s + (o.Gross_Amount__c || o.Amount || 0), 0))}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {otherDeals.map((opp) => {
                          const amount = opp.Gross_Amount__c || opp.Amount || 0;
                          const pp = paymentPct(opp.Percentage_Paid__c);
                          const sc = OPPORTUNITY_STAGES[opp.StageName];
                          return (
                            <div key={opp.Id} className={`${cardCls} p-3.5`} style={cardShadow}>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="text-[13px] font-semibold truncate">{clientName(opp.Name)}</span>
                                <span className="text-[13px] font-bold tabular-nums shrink-0">{formatCurrency(amount)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground/40 truncate">
                                  {opp.Account?.Name}{opp.Owner?.Name && ` · ${opp.Owner.Name}`}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {pp && <span className={`text-[10px] font-medium tabular-nums ${pp.color}`}>{pp.label}</span>}
                                  <span className={`text-[9px] px-1.5 py-[1px] rounded font-medium ${sc?.bgColor || "bg-muted/20 text-muted-foreground"}`}>
                                    {opp.StageName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "financials" && (
            <div className="p-6">
              {/* 50/50 split — Revenue left, Profitability right */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Revenue */}
                <div className={`${cardCls} p-5`} style={cardShadow}>
                  <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium mb-4">Revenue</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground/60">Pipeline value</span>
                      <span className="text-[14px] font-bold tabular-nums">{oppsLoading ? "…" : formatCurrency(totalOppRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground/60">Closed won</span>
                      <span className="text-[14px] font-bold tabular-nums">{formatCurrency(revenueActual)}</span>
                    </div>
                    {revenueTarget > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-muted-foreground/60">Target</span>
                        <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(revenueTarget)} <span className="text-muted-foreground/30 font-normal text-[11px]">({revenuePct}%)</span></span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                      <span className="text-[13px] text-muted-foreground/60">Payments received</span>
                      <span className="text-[14px] font-bold tabular-nums text-emerald-400/80">{formatCurrency(event.Total_Payments_Received__c || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Profitability */}
                <div className={`${cardCls} p-5`} style={cardShadow}>
                  <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium mb-4">Profitability</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground/60">Margin</span>
                      <span className={`text-[14px] font-bold tabular-nums ${margin != null && margin >= 30 ? "text-emerald-400/80" : margin != null && margin >= 15 ? "text-amber-400/80" : ""}`}>
                        {margin != null ? `${margin.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    {event.Total_Margin_Value__c != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-muted-foreground/60">Margin value</span>
                        <span className="text-[14px] font-bold tabular-nums">{formatCurrency(event.Total_Margin_Value__c)}</span>
                      </div>
                    )}
                    {!oppsLoading && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-muted-foreground/60">Deals</span>
                        <span className="text-[13px] tabular-nums font-medium">{wonOpps.length} won <span className="text-muted-foreground/30">/ {opportunities.length} total</span></span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                      <span className="text-[13px] text-muted-foreground/60">Total costs</span>
                      <span className="text-[14px] font-bold tabular-nums">{formatCurrency(totalCosts)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Costs breakdown — only if there are costs */}
              {totalCosts > 0 && (
                <div className={`${cardCls} p-5`} style={cardShadow}>
                  <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-medium mb-4">Cost Breakdown</h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {event.Total_Booking_Cost__c != null && event.Total_Booking_Cost__c > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-muted-foreground/60">Booking costs</span>
                        <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(event.Total_Booking_Cost__c)}</span>
                      </div>
                    )}
                    {event.Total_Staff_Costs__c != null && event.Total_Staff_Costs__c > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-muted-foreground/60">Staff costs</span>
                        <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(event.Total_Staff_Costs__c)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ──

export default function EventsPage() {
  const [events, setEvents] = useState<SalesforceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showPastEvents, setShowPastEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SalesforceEvent | null>(null);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Record<string, HTMLElement | null>>({});

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events/inventory");
      const data = await res.json();
      if (data.success) setEvents(data.data);
    } catch (e) { console.error("Failed to load events", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { const i = setInterval(fetchEvents, 60000); return () => clearInterval(i); }, [fetchEvents]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of events) { if (e.Category__c) cats.add(e.Category__c); }
    return Array.from(cats).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = [...events];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.Name.toLowerCase().includes(q) || (e.Category__c && e.Category__c.toLowerCase().includes(q)) || (e.Location__r?.Name && e.Location__r.Name.toLowerCase().includes(q)));
    }
    if (selectedCategory !== "all") result = result.filter((e) => e.Category__c === selectedCategory);
    if (!showPastEvents) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter((e) => { if (!e.End_Date__c && !e.Start_Date__c) return true; return (e.End_Date__c || e.Start_Date__c)! >= today; });
    }
    result.sort((a, b) => (a.Start_Date__c || "").localeCompare(b.Start_Date__c || ""));
    return result;
  }, [events, search, selectedCategory, showPastEvents]);

  const eventsByMonth = useMemo(() => {
    const grouped: Record<string, SalesforceEvent[]> = {};
    for (const e of filteredEvents) {
      if (!e.Start_Date__c) continue;
      const d = new Date(e.Start_Date__c);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    }
    return grouped;
  }, [filteredEvents]);

  const sortedMonthKeys = useMemo(() => Object.keys(eventsByMonth).sort(), [eventsByMonth]);

  // Scroll spy: detect which month section is visible
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const headerHeight = 64; // sticky header
      let activeMonth = "";

      for (const key of sortedMonthKeys) {
        const el = monthRefs.current[key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;

        if (relativeTop <= headerHeight + 40) {
          activeMonth = key;
        }
      }

      if (activeMonth && activeMonth !== currentMonth) {
        setCurrentMonth(activeMonth);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Initial detection
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [sortedMonthKeys, currentMonth]);

  // Set initial month when data loads
  useEffect(() => {
    if (sortedMonthKeys.length > 0 && !currentMonth) {
      setCurrentMonth(sortedMonthKeys[0]);
    }
  }, [sortedMonthKeys, currentMonth]);

  const formatMonthLabel = (yyyyMM: string) => {
    if (!yyyyMM) return "";
    const [y, m] = yyyyMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
  };

  const formatMonthName = (yyyyMM: string) => {
    if (!yyyyMM) return "Events";
    const [y, m] = yyyyMM.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleString("en-GB", { month: "long" });
  };

  const formatYear = (yyyyMM: string) => {
    if (!yyyyMM) return "";
    return yyyyMM.split("-")[0];
  };

  return (
    <div ref={scrollRef} className="h-dvh overflow-y-auto bg-background p-4 pl-24 lg:p-5 lg:pl-24">
      <div className="max-w-[1600px] mx-auto pb-24">

        {/* ── Sticky Header — Glassmorphic bar ── */}
        <div className="sticky top-0 z-20 pb-2 flex justify-center">
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3 w-full max-w-[1100px]"
            style={{
              background: "rgba(10,10,10,0.65)",
              backdropFilter: "blur(24px) saturate(1.4)",
              WebkitBackdropFilter: "blur(24px) saturate(1.4)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Month title — fixed width to prevent jumping */}
            <div className="flex items-baseline gap-0 shrink-0 overflow-hidden" style={{ width: "140px" }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={currentMonth}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="text-[15px] font-bold text-white tracking-tight whitespace-nowrap"
                >
                  {loading ? "Events" : `${formatMonthName(currentMonth)} ${formatYear(currentMonth)}`}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-white/8 shrink-0" />

            {/* EVENTS CALENDAR label */}
            <span className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-white/20 shrink-0">
              Events Calendar
            </span>

            <div className="flex-1" />

            {/* Search — always visible */}
            <div className="relative w-40">
              <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-white/25" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-6 py-1.5 rounded-lg text-[11px] text-white placeholder:text-white/20 bg-white/[0.04] border border-white/[0.08] outline-none ring-0 focus:outline-none focus:ring-0 focus:border-white/15 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5">
                  <X className="size-2.5 text-white/30 hover:text-white/60" />
                </button>
              )}
            </div>

            {/* Category dropdown — no custom caret, styled select only */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none pl-2.5 pr-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/40 bg-white/[0.04] border border-white/[0.08] hover:border-white/12 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-white/15 cursor-pointer transition-colors"
              style={{
                maxWidth: "120px",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.25)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 6px center",
                paddingRight: "22px",
              }}
            >
              <option value="all">All</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            {/* Past toggle */}
            <button
              onClick={() => setShowPastEvents(!showPastEvents)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                !showPastEvents
                  ? "bg-white/10 text-white/70 border border-white/15"
                  : "text-white/25 hover:text-white/45 border border-transparent hover:border-white/[0.06]"
              }`}
            >
              {showPastEvents ? "Hide Past" : "Show Past"}
            </button>

            {/* Refresh */}
            <button
              onClick={() => { setLoading(true); fetchEvents(); }}
              className="size-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
            >
              <ArrowsClockwise className={`size-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Events — month sections ── */}
        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-muted/20 animate-pulse" style={{ aspectRatio: "3/4" }} />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-32">
              <CalendarBlank className="size-16 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">No events found</p>
              <p className="text-muted-foreground/50 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-14">
              {sortedMonthKeys.map((monthKey) => {
                const monthEvents = eventsByMonth[monthKey];
                return (
                  <section
                    key={monthKey}
                    ref={(el) => { monthRefs.current[monthKey] = el; }}
                    data-month={monthKey}
                  >
                    {/* Month header — elegant inline */}
                    <div className="flex items-baseline gap-4 mb-5">
                      <h2 className="text-2xl font-bold tracking-tight">{formatMonthLabel(monthKey)}</h2>
                      <span className="text-xs text-muted-foreground/40 tabular-nums">{monthEvents.length}</span>
                      <div className="flex-1 h-px bg-border/20 self-center" />
                    </div>

                    {/* Card grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {monthEvents.map((event) => (
                        <EventCard key={event.Id} event={event} onClick={() => setSelectedEvent(event)} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Event detail overlay */}
      <AnimatePresence>
        {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </AnimatePresence>
    </div>
  );
}
