/** Character speech. Silas is wry, tired, and stubbornly hopeful. */
export const SAY = {
  hungry: ['My stomach is making plans without me.', 'I could eat a whole... anything.', 'Food. Soon.'],
  starving: ['I’m wasting away!', 'Must... eat...'],
  cold: ['It’s getting awfully cold.', 'My fingers are going numb.'],
  freezing: ['I’m freezing!', 'Can’t... feel... toes.'],
  hot: ['It’s getting too hot.', 'I need shade.'],
  overheating: ['I’m cooking!', 'Too hot! Too hot!'],
  dusk: ['The light’s going. I should find a fire.', 'Dusk already. Better hurry.'],
  darkWarn: ['It’s too dark to see!', 'Something is moving out there.'],
  hushHit: ['Ow! Something bit me!', 'The dark has teeth!'],
  lowSanity: ['Did that shadow just move?', 'I don’t feel so good.', 'The trees are whispering again.'],
  insane: ['They’re real. They’re REAL.', 'Make them stop looking at me!'],
  houndWarn: ['Did you hear that?', 'Something is hunting me...', 'That growling is getting closer.'],
  houndClose: ['Here they come!'],
  noTool: ['I need a tool for that.', 'My bare hands won’t cut it.'],
  full: ['I can’t carry any more.'],
  cantCraft: ['I don’t have what I need.'],
  prototype: ['Eureka! I understand it now.', 'Ah, so that’s how it works!'],
  toolBroke: ['My tool broke!'],
  wet: ['I’m soaked.', 'Everything is so damp.'],
  cantPlace: ['That won’t fit there.'],
  cantSleepDay: ['It’s far too bright to sleep.'],
  cantSleepDanger: ['I can’t sleep with monsters nearby!'],
  cantSleepHungry: ['I’m too hungry to sleep.'],
  winter: ['Winter’s coming. The air has teeth.'],
  summer: ['The sun has become cruel.'],
  spring: ['Rain, and more rain.'],
  cooked: ['Something smells good.'],
  spoiled: ['Ugh. That was rotten.'],
  trapped: ['Got one!'],
  dawn: ['I made it through the night.', 'Morning. I’m still here.'],
  firstDay: ['Where... am I? I should find some food before dark.'],
  hogFriend: ['A friend! A snouty friend.'],
  cantDoThat: ['I can’t do that.'],
};

export type SayKey = keyof typeof SAY;

export const DEATH_CAUSES: Record<string, string> = {
  starvation: 'Starvation',
  darkness: 'The Hush',
  freezing: 'Freezing',
  overheating: 'Overheating',
  fire: 'Fire',
  food: 'Bad food',
};

export const TIPS = [
  'The dark is not empty. Never be caught without light.',
  'Examine things (right-click) — Silas often knows more than you think.',
  'Hogfolk will follow you for a bit of meat.',
  'Cook Pots reward experimentation.',
  'Shagbeasts sleep at night. That is when the razor comes out.',
  'Rain puts out fires, but not before it soaks you.',
  'Winter is coming sooner than you think.',
  'A Tinker’s Bench teaches you recipes you can remember forever.',
];
