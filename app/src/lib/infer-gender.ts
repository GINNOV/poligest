import type { PatientGender } from "@/lib/patient-avatars";

const FEMALE_FIRST_NAMES = new Set([
  "adele",
  "adriana",
  "alessandra",
  "alessia",
  "alice",
  "amelia",
  "ana",
  "angela",
  "angelica",
  "anna",
  "annalisa",
  "antonella",
  "arianna",
  "barbara",
  "beatrice",
  "benedetta",
  "bianca",
  "camilla",
  "carla",
  "carolina",
  "caterina",
  "cecilia",
  "chiara",
  "claudia",
  "cristina",
  "daniela",
  "debora",
  "diana",
  "elena",
  "eleonora",
  "elisa",
  "elvira",
  "emanuela",
  "emma",
  "erica",
  "fabiana",
  "federica",
  "fiorella",
  "fiorenza",
  "francesca",
  "gabriella",
  "gaia",
  "gianna",
  "giada",
  "ginevra",
  "giorgia",
  "giovanna",
  "giulia",
  "grazia",
  "graziana",
  "ilaria",
  "irene",
  "isabella",
  "laura",
  "letizia",
  "lidia",
  "liliana",
  "livia",
  "loredana",
  "lorena",
  "lucia",
  "luisa",
  "maddalena",
  "manuela",
  "margherita",
  "maria",
  "marianna",
  "marina",
  "marta",
  "martina",
  "matilde",
  "michela",
  "milena",
  "miriam",
  "monica",
  "nadia",
  "natalia",
  "nicoletta",
  "nina",
  "noemi",
  "ornella",
  "paola",
  "patrizia",
  "raffaella",
  "rebecca",
  "regina",
  "renata",
  "rita",
  "roberta",
  "rosa",
  "rosanna",
  "rosaria",
  "sabrina",
  "sandra",
  "sara",
  "serena",
  "silvia",
  "simona",
  "sofia",
  "sonia",
  "stefania",
  "susanna",
  "tamara",
  "teresa",
  "tiziana",
  "valentina",
  "vanessa",
  "veronica",
  "vittoria",
  "viviana",
]);

const MALE_FIRST_NAMES = new Set([
  "achille",
  "adriano",
  "alberto",
  "alessandro",
  "alfonso",
  "alfredo",
  "andrea",
  "angelo",
  "antonio",
  "armando",
  "carlo",
  "claudio",
  "cristiano",
  "daniele",
  "dario",
  "davide",
  "diego",
  "domenico",
  "edoardo",
  "emanuele",
  "enrico",
  "enzo",
  "fabio",
  "federico",
  "fernando",
  "filippo",
  "francesco",
  "franco",
  "gabriele",
  "gaetano",
  "gennaro",
  "giacomo",
  "gianluca",
  "gianni",
  "giorgio",
  "giovanni",
  "giuseppe",
  "lorenzo",
  "luca",
  "luigi",
  "marco",
  "mario",
  "massimo",
  "matteo",
  "mattia",
  "maurizio",
  "michele",
  "nicola",
  "nicolo",
  "paolo",
  "piero",
  "pietro",
  "riccardo",
  "roberto",
  "salvatore",
  "samuele",
  "sergio",
  "simone",
  "stefano",
  "tommaso",
  "umberto",
  "valerio",
  "vincenzo",
  "vittorio",
]);

const MALE_NAMES_ENDING_WITH_A = new Set(["andrea", "joshua", "luca", "mattia", "nicola", "sasha"]);

function normalizeFirstName(firstName?: string | null) {
  const trimmed = (firstName ?? "").trim().toLocaleLowerCase("it");
  if (!trimmed) return "";
  return trimmed.split(/[\s'-]+/)[0] ?? "";
}

export function inferGenderFromTaxId(taxId?: string | null): "MALE" | "FEMALE" | null {
  const normalized = (taxId ?? "").trim().toUpperCase();
  if (normalized.length < 11) return null;

  const dayRaw = normalized.slice(9, 11);
  if (!/^\d{2}$/.test(dayRaw)) return null;

  const dayValue = Number.parseInt(dayRaw, 10);
  if (dayValue < 1 || dayValue > 71) return null;

  return dayValue > 40 ? "FEMALE" : "MALE";
}

export function inferGenderFromFirstName(firstName?: string | null): "MALE" | "FEMALE" | null {
  const normalized = normalizeFirstName(firstName);
  if (!normalized) return null;

  if (FEMALE_FIRST_NAMES.has(normalized)) return "FEMALE";
  if (MALE_FIRST_NAMES.has(normalized)) return "MALE";

  if (MALE_NAMES_ENDING_WITH_A.has(normalized)) return "MALE";

  if (normalized.endsWith("a") && normalized.length > 2) return "FEMALE";
  if (normalized.endsWith("o") && normalized.length > 2) return "MALE";
  if (normalized.endsWith("i") && normalized.length > 2) return "MALE";

  return null;
}

export function resolveEffectiveGender(
  gender: PatientGender,
  firstName?: string | null,
  taxId?: string | null,
): PatientGender {
  if (gender === "MALE" || gender === "FEMALE" || gender === "OTHER") {
    return gender;
  }

  const fromTaxId = inferGenderFromTaxId(taxId);
  if (fromTaxId) return fromTaxId;

  const fromName = inferGenderFromFirstName(firstName);
  if (fromName) return fromName;

  return gender ?? "NOT_SPECIFIED";
}