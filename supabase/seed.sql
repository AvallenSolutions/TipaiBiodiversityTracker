-- ============================================================
-- Tipai Biodiversity Tracker — Species Seed Data
-- Maharashtra forest wildlife (Western Ghats & Sahyadri region)
--
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- image_url uses Wikimedia Commons Special:FilePath redirects,
-- which resolve to the canonical file regardless of thumb path.
-- ============================================================

INSERT INTO public.species
  (common_name, scientific_name, category, description, habitat, image_url)
VALUES

-- ── MAMMALS ──────────────────────────────────────────────────

(
  'Bengal Tiger',
  'Panthera tigris tigris',
  'mammal',
  'The apex predator of the Indian subcontinent. A solitary, territorial hunter, the Bengal tiger is most active at dusk and dawn. Its striped coat provides camouflage in dappled forest light. Adults can weigh up to 260 kg and require large home ranges of 60–100 km².',
  'Dense mixed-deciduous and teak forests, tall grasslands, and riverine corridors. Requires permanent water sources and sufficient prey base of deer and gaur.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Tiger_in_Ranthambhore.jpg&width=800'
),
(
  'Indian Leopard',
  'Panthera pardus fusca',
  'mammal',
  'The most adaptable of India''s large cats, the Indian leopard is a powerful climber that hauls prey into trees to keep it safe from tigers and hyenas. Melanistic (black panther) individuals occur occasionally in the dense forests of the Western Ghats.',
  'Highly adaptable — found in dry scrub, moist deciduous forest, rocky hillsides, and even on the fringes of human settlements. More common at forest edges than tigers.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Indian_Leopard.jpg&width=800'
),
(
  'Sloth Bear',
  'Melursus ursinus',
  'mammal',
  'A shaggy, insectivorous bear built for termite excavation — its flexible snout and missing front teeth form a perfect vacuum tube. Despite their clumsy appearance, sloth bears are fast, aggressive when surprised, and excellent climbers. Cubs ride on their mother''s back for the first year.',
  'Rocky outcrops, dry and moist deciduous forest. Prefers areas with abundant termite mounds and fruiting trees (jamun, mahua). Active mainly at night.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Sloth_Bear_Ranthambore.jpg&width=800'
),
(
  'Indian Gaur',
  'Bos gaurus',
  'mammal',
  'The world''s largest wild bovine, with mature bulls weighing over 1,000 kg. The gaur''s white "stockings" are diagnostic. Despite their size, gaur are shy and melt silently into forest when approached. A key prey species for tigers and leopards.',
  'Dense moist deciduous and evergreen forest with open glades for grazing. Rarely ventures far from permanent water. Often seen at salt licks at dawn.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Indian_Gaur.jpg&width=800'
),
(
  'Sambar Deer',
  'Rusa unicolor',
  'mammal',
  'India''s largest deer, the sambar is the primary prey of tigers in most forest systems. Its loud, resonant alarm call — a sharp "dhank" — is often the first indication of a predator nearby. Stags carry impressive three-tined antlers.',
  'Mixed deciduous and semi-evergreen forest, often near water bodies and forest streams. Highly dependent on water; frequently seen bathing. Nocturnal and crepuscular.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Sambar_deer.jpg&width=800'
),
(
  'Spotted Deer',
  'Axis axis',
  'mammal',
  'Also called chital, the spotted deer is one of India''s most beautiful mammals — its white-spotted rufous coat is retained year-round. Highly social, they associate closely with langur monkeys, benefiting from the monkeys'' aerial vigilance and dropped fruits.',
  'Open deciduous forest, forest edges, and tall grasslands near water. Forms large herds. One of the most abundant large mammals in Indian forests.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Spotted_deer_in_Ranthambore.jpg&width=800'
),
(
  'Indian Giant Squirrel',
  'Ratufa indica',
  'mammal',
  'A spectacular arboreal rodent measuring up to 1 metre from nose to tail-tip, with a bicoloured coat of maroon, cream, and black. It rarely descends to the ground, making great leaps of up to 6 metres between canopy trees. Listed as a state animal of Maharashtra.',
  'Tall, closed-canopy deciduous and semi-evergreen forest. Requires large, emergent trees for nesting. Most active in the early morning and late afternoon.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Malabar_Giant_Squirrel.jpg&width=800'
),
(
  'Wild Boar',
  'Sus scrofa cristatus',
  'mammal',
  'A robust, omnivorous forest pig with a pronounced mane of stiff bristles along its back. Wild boars are intelligent rooting animals that significantly influence forest ecology by turning over soil and dispersing seeds. Boars can be aggressive, especially sows with young.',
  'Extremely adaptable. Found in all forest types, agricultural fringes, grasslands, and stream banks. Nocturnal; groups (sounders) of females and young are common.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Wild_boar_sus_scrofa.jpg&width=800'
),

-- ── BIRDS ────────────────────────────────────────────────────

(
  'Indian Peafowl',
  'Pavo cristatus',
  'bird',
  'India''s national bird and one of the world''s most recognisable, the peacock''s iridescent train of "eyespot" feathers is used in elaborate courtship displays during the monsoon breeding season. The piercing call is a reliable indicator of predator presence — tigers and leopards cause peacocks to alarm consistently.',
  'Forest edges, open woodland, scrub, and agricultural land. Never far from water. Roosts in tall trees. National bird of India.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Pavo_cristatus_Whipsnade_Zoo.jpg&width=800'
),
(
  'Indian Roller',
  'Coracias benghalensis',
  'bird',
  'A medium-sized bird of extraordinary colour — the rolling, tumbling display flight that gives it its name reveals dazzling cobalt-blue wings. Sacred in Hindu tradition, it is released during Dussehra. Often seen perched on telegraph wires or bare branches scanning for large insects.',
  'Open forest, forest edges, scrubland, and farmland with scattered trees. Avoids dense closed-canopy forest. Common at forest clearings.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Coracias_benghalensis_-_Daroji_Bear_Sanctuary.jpg&width=800'
),
(
  'Indian Pitta',
  'Pitta brachyura',
  'bird',
  'A brilliantly coloured, jewel-like bird of the forest floor — turquoise, green, yellow, red, white, and black in a single compact package. Largely terrestrial, it hops through leaf litter hunting invertebrates. Its loud, two-note whistle is the soundtrack of Indian monsoon forests.',
  'Dense moist deciduous and semi-evergreen forest understorey. Forages on the forest floor. Migratory: breeds in foothills, winters in peninsular forests. Most evident during the monsoon.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Indian_Pitta.jpg&width=800'
),
(
  'Crested Serpent Eagle',
  'Spilornis cheela',
  'bird',
  'A medium to large raptor with a bold black-and-white fan crest that erects when alarmed. As its name suggests, it specialises in hunting snakes and lizards, which it detects from a forest perch before dropping onto with powerful taloned feet. Its loud, distinctive call carries far through the canopy.',
  'Dense forest, especially near streams and forest edges. Typically seen soaring on thermals above the canopy or perched on an exposed branch near a water source.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Crested_Serpent_Eagle_India.jpg&width=800'
),
(
  'Indian Paradise Flycatcher',
  'Terpsiphone paradisi',
  'bird',
  'One of India''s most spectacular birds. The adult male in full breeding plumage carries tail streamers up to 30 cm long, fluttering through shaded forest like a white ribbon. Females and young males are rufous. An active aerial insect hunter.',
  'Shaded deciduous and mixed forest with dense understorey, especially near streams. Builds a neat cup nest on a slender branch. Migratory; the white-morph males are most visible March–June.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Indian_Paradise_Flycatcher.jpg&width=800'
),
(
  'White-rumped Shama',
  'Copsychus malabaricus',
  'bird',
  'Regarded as one of the finest songsters in Asia, the shama produces long, liquid, improvisational phrases from deep cover. The male is glossy blue-black above with a chestnut belly and conspicuous white rump. Shy and skulking, it is more often heard than seen.',
  'Dense moist forest understorey, bamboo thickets, and shaded ravines. Found primarily in the Western Ghats and northeastern India. Sedentary.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/White-rumped_Shama.jpg&width=800'
),
(
  'Changeable Hawk-Eagle',
  'Nisaetus cirrhatus',
  'bird',
  'A large, powerful forest eagle with a distinctive crest. An apex avian predator, it takes prey ranging from lizards and squirrels to small deer. Its rising, ringing call from high in the canopy is a defining sound of healthy Indian forest.',
  'Dense deciduous and evergreen forest. Nests on tall emergent trees. Requires large territories with abundant medium-sized prey.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Changeable_Hawk-eagle.jpg&width=800'
),

-- ── REPTILES ─────────────────────────────────────────────────

(
  'Indian Cobra',
  'Naja naja',
  'reptile',
  'The iconic spectacled cobra, with its distinctive hood marking. One of the "Big Four" medically important snakes of India. A vital part of the ecosystem, controlling rodent populations. Worshipped as Nag Devata, it plays a central role in Hindu mythology and Nag Panchami celebrations.',
  'Remarkably versatile — found in forest, agricultural fields, termite mounds, and rock crevices. Avoids dense wet forest. Most active at night.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Indian_cobra_(Naja_naja)_Photograph_By_Shantanu_Kuveskar.jpg&width=800'
),
(
  'Indian Monitor Lizard',
  'Varanus bengalensis',
  'reptile',
  'India''s most widespread monitor lizard, an active, intelligent predator of small vertebrates, eggs, and invertebrates. Its forked tongue flickers constantly, sampling the air for chemical cues. Monitors are protected under Schedule I of the Wildlife Protection Act.',
  'Forest, scrubland, agricultural areas, and riverbanks. An excellent swimmer and climber. Often seen basking on termite mounds or fallen logs.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Bengal_Monitor_Lizard.jpg&width=800'
),
(
  'Mugger Crocodile',
  'Crocodylus palustris',
  'reptile',
  'India''s most widely distributed freshwater crocodile, the mugger has a broad snout and is capable of overland travel between water bodies during the dry season. A powerful ambush predator, it basks extensively on river banks. Listed as Vulnerable on the IUCN Red List.',
  'Rivers, lakes, marshes, reservoirs, and irrigation canals. Most abundant in slow-moving or still water. Nests on sandy or earth banks during the dry season.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Mugger_crocodile_by_Saurabh_Sawant.jpg&width=800'
),
(
  'Russell''s Viper',
  'Daboia russelii',
  'reptile',
  'One of the most dangerous snakes in Asia, responsible for more human fatalities than any other species in the Indian subcontinent. A thick, heavily built viper with a loud, hissing warning. Primarily nocturnal and terrestrial.',
  'Open dry scrub, grassland, forest edges, and cultivated land. Largely absent from dense closed-canopy forest. Moves into rice paddies during the rodent harvest.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Daboia_russelii_by_Jayendra_Chiplunkar.jpg&width=800'
),

-- ── AMPHIBIANS ───────────────────────────────────────────────

(
  'Indian Bullfrog',
  'Hoplobatrachus tigerinus',
  'amphibian',
  'India''s largest frog, reaching up to 17 cm. Breeding males turn brilliant yellow with blue vocal sacs — a remarkable colour transformation tied to monsoon rains. A voracious predator, it can take prey as large as mice and small snakes.',
  'Rice paddies, marshes, ponds, and slow-moving streams. Predominantly terrestrial outside the breeding season. Most abundant in lowland and agricultural areas. Emerges dramatically at the first monsoon rains.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Indian_Bullfrog.jpg&width=800'
),
(
  'Purple Frog',
  'Nasikabatrachus sahyadrensis',
  'amphibian',
  'A remarkable "living fossil" — bloated, purple, and almost perfectly spherical with a tiny pointed snout, this frog spends nearly its entire life underground. It surfaces for only two weeks a year to breed in fast-flowing streams during the monsoon. Discovered by science only in 2003.',
  'Endemic to the Western Ghats. Spends 11 months underground, feeding on termites via a specialised tongue. Breeds in rocky forest streams during the pre-monsoon rains. Critically dependent on intact forest soil.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Nasikabatrachus_sahyadrensis.jpg&width=800'
),

-- ── INSECTS ──────────────────────────────────────────────────

(
  'Blue Mormon',
  'Papilio polymnestor',
  'insect',
  'One of the largest and most striking butterflies of the Western Ghats — an iridescent cobalt-blue swallowtail with a wingspan up to 15 cm. A strong, fast flier that glides through the forest canopy. The larva feeds exclusively on citrus family plants.',
  'Moist deciduous and semi-evergreen forest, forest clearings, and gardens. Seen nectaring on large flowers. Most conspicuous during and after the monsoon.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Blue_Mormon_Papilio_polymnestor_by_Dr_Raju_Kasambe.jpg&width=800'
),
(
  'Malabar Tree Nymph',
  'Idea malabarica',
  'insect',
  'A large, slow-gliding butterfly with translucent white wings mapped with black veins — it drifts through the forest understorey like a floating leaf. The larva sequesters alkaloids from its toxic host plant, making the adult unpalatable to predators.',
  'Dense moist forest and forest edges in the Western Ghats. Strongly associated with closed-canopy conditions. A flagship indicator of forest health.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Idea_malabarica.jpg&width=800'
),

-- ── PLANTS ───────────────────────────────────────────────────

(
  'Teak',
  'Tectona grandis',
  'plant',
  'One of the world''s most valuable hardwoods. Teak forests are the defining landscape of Maharashtra''s deciduous belt — tall, straight boles rising above a sparse understorey that floods with light after leaf-fall. Teak is also a keystone species for many forest animals.',
  'Moist and dry deciduous forest, typically on well-drained hill slopes. Requires a distinct dry season. Dominant in the southern Western Ghats and Vidarbha region. Sheds leaves in the dry season.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Tectona_grandis_Blanco1.124.jpg&width=800'
),
(
  'Mahua',
  'Madhuca longifolia',
  'plant',
  'A large, semi-evergreen tree of extraordinary ecological and cultural importance in central India. Its fleshy, sweet flowers fall in the pre-monsoon and are eaten by bears, deer, boar, civets, and many birds. Tribal communities have depended on mahua flowers and seeds for food, oil, and spirits for millennia.',
  'Dry and moist deciduous forest, forest edges, and village boundaries. One of the most important trees for forest-dependent communities. Flowers March–April, attracting wildlife from considerable distances.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Madhuca_longifolia.jpg&width=800'
),
(
  'Indian Bamboo',
  'Bambusa bambos',
  'plant',
  'The giant thorny bamboo, forming impenetrable clumps that define much of the forest understorey. A critical resource for forest ecosystems — providing cover for leopards and tigers, nesting material for hornbills, and the primary food for gaur and elephants during dry spells.',
  'Moist and semi-evergreen forest, along stream banks and valley floors. One of the fastest-growing plants on Earth. Forms dense, multi-stemmed clumps up to 30 m tall.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Bambusa_bambos.jpg&width=800'
),

-- ── FUNGI ────────────────────────────────────────────────────

(
  'Termite Mushroom',
  'Termitomyces clypeatus',
  'fungi',
  'A large edible mushroom that grows from the fungus gardens cultivated inside termite mounds. Termitomyces species exist in a complex mutualistic relationship with fungus-farming termites — the termites tend and fertilise the fungal gardens, which pre-digest cellulose for the colony. After the first rains, mushrooms erupt overnight.',
  'Emerges from termite mounds in open forest, grassland, and village margins immediately after the first monsoon rains. Found across tropical India wherever Macrotermes termites build mounds.',
  'https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Termitomyces_clypeatus.jpg&width=800'
),

-- ── TRACE ────────────────────────────────────────────────────

(
  'Tiger Pug Mark',
  NULL,
  'trace',
  'The pugmark (footprint) of a Bengal tiger — the most thrilling sign a naturalist can encounter. Tigers mark territories with pugmarks in soft mud or sand along trails and water edges. The large, round front paw (typically 12–15 cm across for a large male) is unmistakable. Pugmarks are used by wildlife managers to census individuals.',
  'Soft mud, sand, or loose soil along forest roads, stream banks, salt licks, and tiger paths. Most evident after rain when soft substrate preserves the impression clearly.',
  NULL
),
(
  'Leopard Scrape',
  NULL,
  'trace',
  'Leopards mark territories with scrapes — defined patches where they rake the ground with their hind feet and deposit faeces or scent. They also scratch trees to mark territory, leaving parallel claw marks at shoulder height. Scats are often placed prominently on rocks or logs.',
  'Forest paths, cliff edges, rocky outcrops, and prominent trees. Scrapes are especially common on elevated ground with wide views. Fresh scrapes may be detected by smell before sight.',
  NULL
)

ON CONFLICT (common_name, category) DO UPDATE
  SET
    scientific_name = EXCLUDED.scientific_name,
    description     = EXCLUDED.description,
    habitat         = EXCLUDED.habitat,
    image_url       = EXCLUDED.image_url;
