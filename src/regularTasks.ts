import {
  abort,
  adv1,
  cliExecute,
  eat,
  fullnessLimit,
  getWorkshed,
  inebrietyLimit,
  myClass,
  myFullness,
  myInebriety,
  retrieveItem,
  reverseNumberology,
  runChoice,
  totalTurnsPlayed,
  useSkill,
  visitUrl,
} from "kolmafia";
import {
  $classes,
  $effect,
  $familiar,
  $item,
  $location,
  $skill,
  AutumnAton,
  Counter,
  ensureFreeRun,
  get,
  getKramcoWandererChance,
  have,
  JuneCleaver,
  questStep,
  set,
  TrainSet,
  tryFindFreeRun,
  withProperty,
} from "libram";
import { CandyTask } from "./lib";
import { drunkSafeWander, wanderWhere } from "./wanderer";
import {
  bestAutumnatonLocation,
  coldMedicineCabinet,
  getBestPantsgivingFood,
  juneCleaverChoices,
  trainset,
} from "./resources";
import CandyEngine from "./engine";
import { combatOutfit, digitizeOutfit } from "./outfit";
import { Outfit } from "grimoire-kolmafia";

const MARKET_QUESTS = [
  { pref: "questM23Meatsmith", url: "shop.php?whichshop=meatsmith&action=talk" },
  { pref: "questM24Doc", url: "shop.php?whichshop=doc&action=talk" },
  { pref: "questM25Armorer", url: "shop.php?whichshop=armory&action=talk" },
];

const GLOBAL_TASKS: CandyTask[] = [
  ...MARKET_QUESTS.map(({ pref, url }) => ({
    name: `Start Quest: ${pref}`,
    completed: () => questStep(pref) > -1,
    do: (): void => {
      visitUrl(url);
      runChoice(1);
    },
  })),
  {
    name: "Acquire Kgnee",
    ready: () =>
      have($familiar`Reagnimated Gnome`) &&
      !have($item`gnomish housemaid's kgnee`) &&
      !get("_freecandy_checkedGnome", false),
    completed: () => get("_freecandy_checkedGnome", false),
    do: (): void => {
      visitUrl("arena.php");
      runChoice(4);
      set("_freecandy_checkedGnome", true);
    },
    outfit: { familiar: $familiar`Reagnimated Gnome` },
    limit: { tries: 1 },
  },
  {
    name: "Beaten Up!",
    completed: () => !have($effect`Beaten Up`),
    ready: () => !["Poetic Justice", "Lost and Found"].includes(get("lastEncounter")),
    do: () => abort("Beaten up!"),
  },
  {
    name: "Sweat Out some Booze",
    completed: () => get("_sweatOutSomeBoozeUsed") >= 3,
    ready: () => myInebriety() > 0 && get("sweat") >= 25,
    do: () => useSkill($skill`Sweat Out Some Booze`),
    outfit: { pants: $item`designer sweatpants` },
    sobriety: "sober",
  },
  {
    name: "Numberology",
    ready: () => Object.values(reverseNumberology()).includes(69) && get("skillLevel144") <= 3,
    completed: () => get("_universeCalculated") >= get("skillLevel144"),
    do: () => cliExecute("numberology 69"),
  },
  {
    name: "Fill Pantsgiving Fullness",
    ready: () =>
      !$classes`Vampyre, Grey Goo`.includes(myClass()) && myFullness() + 1 === fullnessLimit(),
    completed: () => myFullness() >= fullnessLimit(),
    do: (): void => {
      const { food } = getBestPantsgivingFood();
      if (!get("_fudgeSporkUsed")) {
        retrieveItem($item`fudge spork`);
        eat($item`fudge spork`);
      }
      retrieveItem(food);
      eat(food);
    },
  },
  {
    name: "Autumn-Aton",
    completed: () => !AutumnAton.available(),
    do: () => AutumnAton.sendTo(bestAutumnatonLocation),
  },
  {
    name: "Cold Medicine Cabinet",
    ready: () => getWorkshed() === $item`cold medicine cabinet`,
    completed: () =>
      get("_coldMedicineConsults") >= 5 || get("_nextColdMedicineConsult") > totalTurnsPlayed(),
    do: coldMedicineCabinet,
  },
  {
    name: "Trainset",
    ready: () => getWorkshed() === $item`model train set`,
    completed: () => !TrainSet.canConfigure(),
    do: trainset,
  },
  {
    name: "June Cleaver",
    completed: () => !JuneCleaver.have() || !!get("_juneCleaverFightsLeft"),
    do: () =>
      withProperty("recoveryScript", "", () => {
        const target =
          myInebriety() > inebrietyLimit() ? $location`Drunken Stupor` : $location`Noob Cave`;
        adv1(target, -1, "");
      }),
    choices: juneCleaverChoices,
    outfit: { weapon: $item`June cleaver` },
  },
  {
    name: "Proton Ghost",
    completed: () => get("questPAGhost") === "unstarted",
    ready: () =>
      have($item`protonic accelerator pack`) &&
      !!get("ghostLocation"),
    do: () => get("ghostLocation") ?? abort("Failed to find proper ghost location"),
    outfit: () => combatOutfit({ back: $item`protonic accelerator pack` }),
  },
  {
    name: "Vote Wanderer",
    ready: () =>
      have($item`"I Voted!" sticker`) &&
      totalTurnsPlayed() % 11 === 1 &&
      get("_voteFreeFights") < 3,
    do: () => drunkSafeWander("wanderer"),
    completed: () => get("lastVoteMonsterTurn") === totalTurnsPlayed(),
    outfit: () => combatOutfit({ acc1: $item`"I Voted!" sticker` }),
  },
  {
    name: "Digitize Wanderer",
    completed: () => Counter.get("Digitize") > 0,
    do: () => drunkSafeWander("wanderer"),
    post: () =>
      get("_sourceTerminalDigitizeMonsterCount") || (CandyEngine.digitizeInitialized = false),
    outfit: digitizeOutfit,
  },
  {
    name: "Void Monster",
    ready: () => have($item`cursed magnifying glass`) && get("cursedMagnifyingGlassCount") === 13,
    completed: () => get("_voidFreeFights") >= 5,
    do: () => drunkSafeWander("wanderer"),
    sobriety: "sober",
    outfit: () => combatOutfit({ offhand: $item`cursed magnifying glass` }),
  },
  {
    name: "Kramco",
    ready: () => have($item`Kramco Sausage-o-Matic™`),
    completed: () => getKramcoWandererChance() < 1,
    do: () => wanderWhere("wanderer"),
    sobriety: "sober",
    canInitializeDigitize: true,
    outfit: () => combatOutfit({ offhand: $item`Kramco Sausage-o-Matic™` }),
  },
  {
    name: "Yellow Ray: Fondeluge",
    ready: () => have($skill`Fondeluge`),
    completed: () => have($effect`Everything Looks Yellow`),
    do: () => wanderWhere("yellow ray"),
    sobriety: "sober",
    canInitializeDigitize: true,
    outfit: combatOutfit,
  },
  {
    name: "Yellow Ray: Jurassic Parka",
    ready: () => have($item`Jurassic Parka`) && have($skill`Torso Awareness`),
    completed: () => have($effect`Everything Looks Yellow`),
    do: () => wanderWhere("yellow ray"),
    sobriety: "sober",
    canInitializeDigitize: true,
    outfit: () => combatOutfit({ shirt: $item`Jurassic Parka`, modes: { parka: "dilophosaur" } }),
  },
  {
    name: "Free-for-All",
    ready: () => have($skill`Free-For-All`),
    completed: () => have($effect`Everything Looks Red`),
    do: () => wanderWhere("backup"),
    sobriety: "sober",
    canInitializeDigitize: true,
    outfit: combatOutfit,
  },
  {
    name: "Nemesis Assassin",
    completed: () => Counter.get("Nemesis Assassin window end") > 0,
    do: () => wanderWhere("wanderer"),
    canInitializeDigitize: true,
    outfit: combatOutfit,
  },
  {
    name: "Initialize Digitize",
    completed: () => CandyEngine.digitizeInitialized,
    do: (): void => {
      CandyEngine.runSource?.prepare();
      wanderWhere("backup");
    },
    canInitializeDigitize: true,
    prepare: (): void => {
      const run =
        tryFindFreeRun() ??
        ensureFreeRun({
          requireUnlimited: () => true,
          noFamiliar: () => true,
          noRequirements: () => true,
          maximumCost: () => get("autoBuyPriceLimit") ?? 20000,
        });
      if (!run) abort("Unable to find free run with which to initialize digitize!");
      CandyEngine.runSource = run;
    },
    post: () => (CandyEngine.runSource = null),
    outfit: (): Outfit => {
      const req = CandyEngine.runSource?.constraints?.equipmentRequirements?.();
      const familiar = CandyEngine.runSource?.constraints?.familiar?.();
      const outfit = new Outfit();
      if (familiar) outfit.equip(familiar);
      if (req) {
        if (req.maximizeParameters) outfit.modifier = req.maximizeParameters;
        for (const item of req.maximizeOptions.forceEquip ?? []) {
          if (!outfit.equip(item)) abort(`Failed to equip item ${item} for free running`);
        }
      }
      return combatOutfit(outfit.spec());
    },
  },
];

export default GLOBAL_TASKS;