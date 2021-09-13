import "core-js/modules/es.object.entries";
import {
  bjornifyFamiliar,
  buy,
  canEquip,
  effectModifier,
  enthroneFamiliar,
  equippedItem,
  fullnessLimit,
  getOutfits,
  haveEquipped,
  inebrietyLimit,
  mallPrice,
  myAdventures,
  myClass,
  myEffects,
  myFamiliar,
  myFullness,
  myInebriety,
  myLevel,
  numericModifier,
  outfitPieces,
  outfitTreats,
  runChoice,
  toEffect,
  toItem,
  toSlot,
  totalTurnsPlayed,
  visitUrl,
} from "kolmafia";
import {
  $class,
  $familiar,
  $familiars,
  $item,
  $items,
  $skill,
  $slot,
  $slots,
  clamp,
  get,
  getAverageAdventures,
  getFoldGroup,
  getSaleValue,
  have,
  maximizeCached,
  property,
  Requirement,
  sum,
  sumNumbers,
} from "libram";
import { bjornValue, pickBjorn } from "./bjorn";
import { cache, leprechaunMultiplier, meatFamiliar, trickFamiliar } from "./lib";

const actionRateBonus = () =>
  numericModifier("Familiar Action Bonus") / 100 +
  ($items`short stack of pancakes, short stick of butter, short glass of water`
    .map((item) => effectModifier(item, "Effect"))
    .some((effect) => have(effect))
    ? 1
    : 0);

const trickHats = $items`invisible bag, witch hat, beholed bedsheet, wolfman mask, pumpkinhead mask, mummy costume`;
const adventureFamiliars = $familiars`Temporal Riftlet, Reagnimated Gnome`;

type stasisValue = {
  baseRate: number;
  meatPerLb: number;
};

const stasisFamiliars = new Map<Familiar, stasisValue>([
  [$familiar`Ninja Pirate Zombie Robot`, { baseRate: 1 / 2, meatPerLb: 14.52 }],
  [$familiar`Cocoabo`, { baseRate: 1 / 3, meatPerLb: 13.2 }],
  [$familiar`Stocking Mimic`, { baseRate: 1 / 3, meatPerLb: 13.2 }],
  [$familiar`Feather Boa Constrictor`, { baseRate: 1 / 3, meatPerLb: 27.5 }],
]);

//Note: both this and the weight --> weightvalue function undervalue weight. Consider fixing that.
function estimateOutfitWeight(): number {
  if (!cache.outfightWeight) {
    const accessoriesFree =
      3 -
      $items`Mr. Screege's spectacles, Mr. Cheeng's spectacles, lucky gold ring`.filter((item) =>
        have(item)
      ).length;

    const openSlots = [
      ...$slots`shirt, weapon, off-hand`,
      ...(have($item`Buddy Bjorn`) ? [] : $slots`back`),
      ...(get("_pantogramModifier").includes("Drops Items") ? [] : $slots`pants`),
    ];

    const viableItems = Item.all().filter(
      (item) =>
        have(item) &&
        (openSlots.includes(toSlot(item)) || (toSlot(item) === $slot`acc1` && accessoriesFree))
    );

    const nonAccessoryWeightEquips = openSlots.map(
      (slot) =>
        viableItems
          .filter((item) => toSlot(item) === slot)
          .sort(
            (a, b) => numericModifier(b, "Familiar Weight") - numericModifier(a, "Familiar Weight")
          )[0]
    );
    const accessoryWeightEquips = accessoriesFree
      ? viableItems
          .filter((item) => toSlot(item) === $slot`acc1`)
          .sort(
            (a, b) => numericModifier(b, "Familiar Weight") - numericModifier(a, "Familiar Weight")
          )
          .splice(0, accessoriesFree)
      : [];

    cache.outfightWeight =
      sum([...accessoryWeightEquips, ...nonAccessoryWeightEquips], (item: Item) =>
        numericModifier(item, "Familiar Weight")
      ) +
      (have($familiar`Temporal Riftlet`) ? 10 : 0) +
      (have($skill`Amphibian Sympathy`) ? 5 : 0);
  }
  return cache.outfightWeight;
}

function getEffectWeight(): number {
  if (!cache.effectWeight) {
    cache.effectWeight = sum(
      Object.entries(myEffects())
        .map(([name, duration]) => {
          return {
            effect: toEffect(name),
            duration: duration,
          };
        })
        .filter(
          (effectAndDuration) =>
            numericModifier(effectAndDuration.effect, "Familiar Weight") &&
            effectAndDuration.duration >= myAdventures()
        )
        .map((effectAndDuration) => effectAndDuration.effect),
      (effect) => numericModifier(effect, "Familiar Weight")
    );
  }
  return cache.effectWeight;
}

export type fightType = "Kramco" | "Digitize" | "Voter" | "Trick" | "Ghost";
export function fightOutfit(type: fightType = "Trick"): void {
  if (!trickHats.some((hat) => have(hat))) {
    buy(1, trickHats.sort((a, b) => mallPrice(b) - mallPrice(a))[0]);
  }
  const trickHat = trickHats.find((hat) => have(hat)) || $item`beholed bedsheet`; //Just to stop it from being undefined

  const forceEquips: Item[] = [];

  const bonusEquips = new Map<Item, number>([
    [$item`lucky gold ring`, 400],
    [$item`Mr. Cheeng's spectacles`, 250],
    [$item`pantogram pants`, get("_pantogramModifier").includes("Drops Items") ? 100 : 0],
    [$item`Mr. Screege's spectacles`, 180],
    [
      $item`bag of many confections`,
      getSaleValue(...$items`Polka Pop, BitterSweetTarts, Piddles`) / 6,
    ],
    ...snowSuit(),
    ...mayflowerBouquet(),
    ...pantsgiving(),
  ]);

  switch (type) {
    case "Kramco":
      forceEquips.push($item`Kramco Sausage-o-Matic™`);
      break;
    case "Voter":
      forceEquips.push($item`"I Voted!" sticker`);
      if (myInebriety() > inebrietyLimit()) forceEquips.push($item`Drunkula's wineglass`);
      break;
    case "Ghost":
      forceEquips.push($item`protonic accelerator pack`);
      break;
    case "Trick":
      forceEquips.push(trickHat);
      break;
    case "Digitize":
      if (myInebriety() > inebrietyLimit()) forceEquips.push($item`Drunkula's wineglass`);
      break;
  }

  if (
    have($item`protonic accelerator pack`) &&
    forceEquips.every((item) => toSlot(item) !== $slot`back`) &&
    get("questPAGhost") === "unstarted" &&
    get("nextParanormalActivity") <= totalTurnsPlayed()
  )
    forceEquips.push($item`protonic accelerator pack`);

  if (trickFamiliar() === $familiar`Reagnimated Gnome`) {
    forceEquips.push($item`gnomish housemaid's kgnee`);
    if (!have($item`gnomish housemaid's kgnee`)) {
      visitUrl("arena.php");
      runChoice(4);
    }
  }

  const stasisData = stasisFamiliars.get(myFamiliar());
  if (stasisData) {
    if (
      stasisData.baseRate + actionRateBonus() < 1 &&
      getFoldGroup($item`Loathing Legion helicopter`).some((foldable) => have(foldable))
    ) {
      forceEquips.push($item`Loathing Legion helicopter`);
    }
  }

  const weightValue = stasisData
    ? //action rate times weight per lb
      clamp(
        stasisData.baseRate +
          actionRateBonus() +
          (forceEquips.includes($item`Loathing Legion helicopter`) &&
          !haveEquipped($item`Loathing Legion helicopter`)
            ? 0.25
            : 0),
        0,
        1
      ) * stasisData.meatPerLb
    : adventureFamiliars.includes(trickFamiliar())
    ? //1.1 multiplier meant to account for linearization and weight estimates undervaluing gnome lbs
      (1.1 * (1000 * baseAdventureValue())) /
      Math.pow(1000 - (estimateOutfitWeight() + getEffectWeight() + 20), 2)
    : 0;

  const bjornalikeToUse = bestBjornalike(forceEquips);
  if (bjornalikeToUse) bonusEquips.set(bjornalikeToUse, bjornValue(pickBjorn()));

  maximizeCached([`${Math.round(weightValue * 100) / 100} Familiar Weight`, "0.25 Meat Drop"], {
    forceEquip: forceEquips,
    bonusEquip: bonusEquips,
    preventSlot: $slots`buddy-bjorn, crown-of-thrones`,
    preventEquip:
      bjornalikeToUse === $item`Buddy Bjorn` ? $items`Crown of Thrones` : $items`Buddy Bjorn`,
  });

  if (haveEquipped($item`Buddy Bjorn`)) bjornifyFamiliar(pickBjorn().familiar);
  if (haveEquipped($item`Crown of Thrones`)) enthroneFamiliar(pickBjorn().familiar);
}

function snowSuit() {
  if (!have($item`Snow Suit`) || get("_carrotNoseDrops") >= 3) return new Map<Item, number>([]);

  return new Map<Item, number>([[$item`Snow Suit`, getSaleValue($item`carrot nose`) / 10]]);
}

function mayflowerBouquet() {
  // +40% meat drop 12.5% of the time (effectively 5%)
  // Drops flowers 50% of the time, wiki says 5-10 a day.
  // Theorized that flower drop rate drops off but no info on wiki.
  // During testing I got 4 drops then the 5th took like 40 more adventures
  // so let's just assume rate drops by 11% with a min of 1% ¯\_(ツ)_/¯

  if (!have($item`Mayflower bouquet`) || get("_mayflowerDrops") >= 10)
    return new Map<Item, number>([]);

  const averageFlowerValue =
    getSaleValue(
      ...$items`tin magnolia, upsy daisy, lesser grodulated violet, half-orchid, begpwnia`
    ) * Math.max(0.01, 0.5 - get("_mayflowerDrops") * 0.11);
  return new Map<Item, number>([[$item`Mayflower bouquet`, averageFlowerValue]]);
}

function pantsgiving(): Map<Item, number> {
  if (!have($item`Pantsgiving`)) return new Map<Item, number>();
  const count = get("_pantsgivingCount");
  const turnArray = [5, 50, 500, 5000];
  const index =
    myFullness() === fullnessLimit()
      ? get("_pantsgivingFullness")
      : turnArray.findIndex((x) => count < x);
  const turns = turnArray[index] || 50000;

  if (turns - count > myAdventures()) return new Map<Item, number>();
  const food = getPantsgivingFood();
  const value =
    food === $item`Dreadsylvanian stew`
      ? (1 / 20) *
        Math.max(mallPrice($item`electric Kool-Aid`), mallPrice($item`bottle of Bloodweiser`))
      : mallPrice(food);
  const fullnessValue =
    overallAdventureValue() * (getAverageAdventures(food) + 1 + (get("_fudgeSporkUsed") ? 3 : 0)) -
    value -
    mallPrice($item`Special Seasoning`) -
    (get("_fudgeSporkUsed") ? mallPrice($item`fudge spork`) : 0);
  const pantsgivingBonus = fullnessValue / (turns * 0.9);
  return new Map<Item, number>([[$item`Pantsgiving`, pantsgivingBonus]]);
}

function overallAdventureValue(): number {
  const bonuses = new Map<Item, number>([
    [$item`lucky gold ring`, 400],
    [$item`Mr. Cheeng's spectacles`, 250],
    [$item`pantogram pants`, get("_pantogramModifier").includes("Drops Items") ? 100 : 0],
    [$item`Mr. Screege's spectacles`, 180],
    [
      $item`bag of many confections`,
      getSaleValue(...$items`Polka Pop, BitterSweetTarts, Piddles`) / 6,
    ],
    ...snowSuit(),
    ...mayflowerBouquet(),
  ]);
  const treatsAndBonusEquips =
    sum(
      Slot.all().map((slot) => {
        const equip = equippedItem(slot);
        const bonus = bonuses.get(equip);
        return bonus === undefined ? 0 : bonus;
      }),
      (number: number) => number
    ) +
    baseAdventureValue() +
    (haveEquipped($item`Buddy Bjorn`) || haveEquipped($item`Crown of Thrones`)
      ? bjornValue(pickBjorn())
      : 0);
  const stasisData = stasisFamiliars.get(trickFamiliar());
  if (stasisData) {
    return (
      treatsAndBonusEquips +
      (20 + estimateOutfitWeight() + getEffectWeight()) *
        (stasisData.meatPerLb * clamp(stasisData.baseRate + actionRateBonus(), 0, 1))
    );
  } else if (adventureFamiliars.includes(trickFamiliar())) {
    return (
      (treatsAndBonusEquips * 1000) /
      Math.pow(1000 - getEffectWeight() - estimateOutfitWeight() - 20, 2)
    );
  } else return treatsAndBonusEquips;
}

export function getPantsgivingFood(): Item {
  if (!cache.pantsgivingFood) {
    if (get("affirmationCookiesEaten") >= 4) cache.pantsgivingFood = $item`Affirmation Cookie`;
    else if (
      myLevel() >= 20 &&
      (have($item`Dreadsylvanian stew`) || have($item`Freddy Kruegerand`, 20))
    )
      cache.pantsgivingFood = $item`Dreadsylvanian stew`;
    else cache.pantsgivingFood = $item`meteoreo`;
  }
  return cache.pantsgivingFood;
}

export function baseAdventureValue(): number {
  if (cache.baseAdventureValue === undefined) {
    cache.baseAdventureValue =
      (1 / 5) *
      (3 *
        sumNumbers(
          Object.entries(outfitTreats(bestOutfit())).map(
            ([candyName, probability]) => getSaleValue(toItem(candyName)) * probability
          )
        ) *
        (have($familiar`Trick-or-Treating Tot`) ? 1.6 : 0) +
        (1 / 5) * getSaleValue($item`huge bowl of candy`) +
        (have($familiar`Trick-or-Treating Tot`) ? 4 * 0.2 * getSaleValue($item`Prunets`) : 0));
  }
  return cache.baseAdventureValue;
}

export function bestOutfit(): string {
  if (!cache.bestOutfit) {
    const playerChosenOutfit = property.getString("freecandy_treatOutfit");
    if (playerChosenOutfit) cache.bestOutfit = playerChosenOutfit;
    else {
      const flyestFit = getOutfits()
        .filter((outfitName) => outfitPieces(outfitName).every((piece) => canEquip(piece)))
        .map(
          (outfitName) =>
            [
              outfitName,
              sumNumbers(
                Object.entries(outfitTreats(outfitName)).map(
                  ([candyName, probability]) => getSaleValue(toItem(candyName)) * probability
                )
              ),
            ] as [string, number]
        )
        .sort((a, b) => b[1] - a[1])[0][0];

      if (!flyestFit) throw "You somehow have no outfits, dude!";
      cache.bestOutfit = flyestFit;
    }
  }
  return cache.bestOutfit;
}

export function meatOutfit(): void {
  const bjornFam = pickBjorn();
  const bjornalike = bestBjornalike([]);
  new Requirement(["1000 Meat Drop"], {
    bonusEquip: new Map<Item, number>([
      [$item`lucky gold ring`, 400],
      [$item`Mr. Cheeng's spectacles`, 250],
      [$item`pantogram pants`, get("_pantogramModifier").includes("Drops Items") ? 100 : 0],
      [$item`Mr. Screege's spectacles`, 180],
      [
        $item`bag of many confections`,
        getSaleValue(...$items`Polka Pop, BitterSweetTarts, Piddles`) / 6,
      ],
      ...snowSuit(),
      ...mayflowerBouquet(),
      [$item`mafia thumb ring`, 0.04 * overallAdventureValue()],
      ...(bjornalike ? new Map([[bjornalike, bjornValue(bjornFam)]]) : []),
    ]),
    preventEquip: $items`Buddy Bjorn, Crown of Thrones`.filter((bjorn) => bjorn !== bjornalike),
    forceEquip: myInebriety() > inebrietyLimit() ? $items`Drunkula's wineglass` : [],
  }).maximize();
  if (haveEquipped($item`Buddy Bjorn`)) bjornifyFamiliar(bjornFam.familiar);
  else if (haveEquipped($item`Crown of Thrones`)) enthroneFamiliar(bjornFam.familiar);
}

function bestBjornalike(existingForceEquips: Item[]): Item | undefined {
  const bjornalikes = $items`Buddy Bjorn, Crown of Thrones`;
  const slots = bjornalikes
    .map((bjornalike) => toSlot(bjornalike))
    .filter((slot) => !existingForceEquips.some((equipment) => toSlot(equipment) === slot));
  if (!slots.length) return undefined;
  if (slots.length < 2 || bjornalikes.some((thing) => !have(thing))) {
    return bjornalikes.find((thing) => have(thing) && slots.includes(toSlot(thing)));
  }

  const hasStrongLep = leprechaunMultiplier(meatFamiliar()) >= 2;
  const goodRobortHats = $items`crumpled felt fedora`;
  if (myClass() === $class`Turtle Tamer`) goodRobortHats.push($item`warbear foil hat`);
  if (numericModifier($item`shining star cap`, "Familiar Weight") === 10)
    goodRobortHats.push($item`shining star cap`);
  if (have($item`carpe`) && (!hasStrongLep || !goodRobortHats.some((hat) => have(hat)))) {
    return $item`Crown of Thrones`;
  }
  return $item`Buddy Bjorn`;
}
