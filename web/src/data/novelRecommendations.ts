export interface NovelRecommendation {
    title: string;
    url: string;
    genre:
        | "Isekai & Fantasy"
        | "Psychological"
        | "Mystery & Historical"
        | "Rom-Com & Slice of Life"
        | "Action & Dungeon";
    description: string;
    basedOn: string;
}

export const NOVEL_CATALOG: NovelRecommendation[] = [
    // Isekai & Fantasy
    {
        title: "Mushoku Tensei: Isekai Ittara Honki Dasu",
        url: "https://meionovels.com/novel/mushoku-tensei-isekai-ittara-honki-dasu-ln/",
        genre: "Isekai & Fantasy",
        description:
            "The grandfather of modern isekai. A 34-year-old NEET reincarnates into a world of magic with memories intact.",
        basedOn: "Re:Zero, Seirei Gensouki",
    },
    {
        title: "Kage no Jitsuryokusha ni Naritakute! (The Eminence in Shadow)",
        url: "https://meionovels.com/novel/kage-no-jitsuryokusha-ni-naritakute-ln/",
        genre: "Isekai & Fantasy",
        description:
            "Cid Kagenou wants neither to be a hero nor a final boss, but to operate in the shadows. Pure chuunibyou comedy.",
        basedOn: "Tensura, Death March",
    },
    {
        title: "Overlord",
        url: "https://meionovels.com/novel/overlord-ln/",
        genre: "Isekai & Fantasy",
        description:
            "Momonga stays online as his favorite MMORPG shuts down, getting transported as an undead overlord with supreme power.",
        basedOn: "Tensura, Realist Hero",
    },
    {
        title: "Kumo desu ga, Nani ka? (So I'm a Spider, So What?)",
        url: "https://meionovels.com/novel/kumo-desu-ga-nani-ka-ln/",
        genre: "Isekai & Fantasy",
        description:
            "A high school girl is reborn as a weak dungeon spider and must survive perilous labyrinth beasts.",
        basedOn: "Saijaku Tamer, TenKen",
    },
    {
        title: "Tsuki ga Michibiku Isekai Douchuu (Moonlit Fantasy)",
        url: "https://meionovels.com/novel/tsuki-ga-michibiku-isekai-douchuu-ln/",
        genre: "Isekai & Fantasy",
        description:
            "Summoned by a Goddess who calls him ugly and banishes him to the wasteland, Makoto builds a demi-human sanctuary.",
        basedOn: "Tondemo Skill, Tensura",
    },
    {
        title: "Tate no Yuusha no Nariagari (The Rising of the Shield Hero)",
        url: "https://meionovels.com/novel/tate-no-yuusha-no-nariagari-ln/",
        genre: "Isekai & Fantasy",
        description:
            "Naofumi is summoned as one of four cardinal heroes, framed by royalty, and rises from betrayal.",
        basedOn: "Seirei Gensouki, Danmachi",
    },
    {
        title: "Isekai Nonbiri Nouka (Farming Life in Another World)",
        url: "https://meionovels.com/novel/isekai-nonbiri-nouka-ln/",
        genre: "Isekai & Fantasy",
        description:
            "Hiraku receives a healthy body and almighty farming tool from God, starting a peaceful village in a dark forest.",
        basedOn: "Easygoing Territory Defense, Tondemo Skill",
    },

    // Psychological & Mind Games
    {
        title: "Classroom of the Elite: Year 2 (2-nensei-hen)",
        url: "https://meionovels.com/novel/youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e-2-nensei-hen-ln/",
        genre: "Psychological",
        description:
            "The direct sequel to COTE Year 1. Ayanokouji and Class D enter their second year facing new White Room enforcers.",
        basedOn: "Classroom of the Elite (COTE)",
    },
    {
        title: "Yahari Ore no Seishun Love Come wa Machigatteiru (Oregairu)",
        url: "https://meionovels.com/novel/yahari-ore-no-seishun-love-comedy-wa-machigatteiru-ln/",
        genre: "Psychological",
        description:
            "Cynical loner Hachiman Hikigaya is forced into the Service Club to solve students' complicated social dilemmas.",
        basedOn: "Classroom of the Elite, Makeine",
    },
    {
        title: "Liar Liar",
        url: "https://meionovels.com/novel/liar-liar-ln/",
        genre: "Psychological",
        description:
            "On Academy Island, students duel for stars. Hiroto accidentally defeats the empress on day one and bluffs to the top.",
        basedOn: "Classroom of the Elite",
    },
    {
        title: "No Game No Life",
        url: "https://meionovels.com/novel/no-game-no-life-ln/",
        genre: "Psychological",
        description:
            "Genius shut-in gamer siblings Sora and Shiro are summoned to Disboard, a world where everything is decided by games.",
        basedOn: "The Genius Prince, COTE",
    },

    // Mystery & Historical
    {
        title: "Koukyuu no Karasu (Raven of the Inner Palace)",
        url: "https://meionovels.com/novel/koukyuu-no-karasu-ln/",
        genre: "Mystery & Historical",
        description:
            "Deep in the inner palace lives the Raven Consort, an enigmatic maiden solving court curses and spectral mysteries.",
        basedOn: "Kusuriya no Hitorigoto (Apothecary Diaries)",
    },
    {
        title: "Tearmoon Teikoku Monogatari (Tearmoon Empire)",
        url: "https://meionovels.com/novel/tearmoon-teikoku-monogatari-ln/",
        genre: "Mystery & Historical",
        description:
            "Selfish Princess Mia is guillotined during revolution, only to wake up as a 12-year-old with her bloodstained diary.",
        basedOn: "The Genius Prince, Bookworm",
    },
    {
        title: "Majo no Tabitabi (Wandering Witch: The Journey of Elaina)",
        url: "https://meionovels.com/novel/majo-no-tabitabi-ln/",
        genre: "Mystery & Historical",
        description:
            "A free-spirited witch travels across strange nations, uncovering poignant, melancholic, and mysterious tales.",
        basedOn: "Secrets of the Silent Witch, Grimgar",
    },

    // Rom-Com & Slice of Life
    {
        title: "The Angel Next Door Spoils Me Rotten (Otonari no Tenshi-sama)",
        url: "https://meionovels.com/novel/otonari-no-tenshi-sama-ni-itsu-no-ma-ni-ka-dame-ningen-ni-sareteita-ken-ln/",
        genre: "Rom-Com & Slice of Life",
        description:
            "After lending an umbrella on a rainy day, Amane's neighbor Mahiru—the school's angel—starts cooking and caring for him.",
        basedOn: "Roshidere, Makeine",
    },
    {
        title: "Gimai Seikatsu (Days with My Stepsister)",
        url: "https://meionovels.com/novel/gimai-seikatsu-ln/",
        genre: "Rom-Com & Slice of Life",
        description:
            "Yuuta and Saki become stepsiblings after parental remarriage, navigating emotional boundaries with quiet realism.",
        basedOn: "Makeine, Roshidere",
    },
    {
        title: "Chitose-kun wa Ramune Bin no Naka (Chiramune)",
        url: "https://meionovels.com/novel/chitose-kun-wa-ramune-bin-no-naka-ln/",
        genre: "Rom-Com & Slice of Life",
        description:
            "Top-tier popular high-schooler Saku Chitose helps re-integrate a reclusive shut-in classmate into school hierarchy.",
        basedOn: "Makeine, COTE",
    },

    // Action & Dungeon Crawling
    {
        title: "Goblin Slayer",
        url: "https://meionovels.com/novel/goblin-slayer-ln/",
        genre: "Action & Dungeon",
        description:
            "A silver-ranked adventurer who refuses all noble quests to dedicate his existence to eradicating goblins with brutal tactics.",
        basedOn: "Grimgar of Fantasy and Ash, Danmachi",
    },
    {
        title: "Arifureta Shokugyou de Sekai Saikyou",
        url: "https://meionovels.com/novel/arifureta-shokugyou-de-sekai-saikyou-ln/",
        genre: "Action & Dungeon",
        description:
            "Betrayed and shoved into the deepest abyss of an Orcus labyrinth, Hajime transmutes monsters to survive and conquer.",
        basedOn: "Danmachi, TenKen",
    },
    {
        title: "Solo Leveling",
        url: "https://meionovels.com/novel/solo-leveling-novel/",
        genre: "Action & Dungeon",
        description:
            "The weakest E-rank hunter Sung Jin-woo awakens a unique quest system that allows him to level up without limits.",
        basedOn: "Danmachi, TenKen",
    },
];

/**
 * Returns novel recommendations that are NOT already present in the user's library,
 * sorted intelligently based on matching genres in the existing collection.
 */
export function getSmartRecommendations(
    existingNovels: { title: string; url: string }[],
): NovelRecommendation[] {
    // Normalize existing URLs and titles for fast lookup
    const existingUrls = new Set(
        existingNovels.map((n) =>
            (n.url || "").toLowerCase().trim().replace(/\/+$/, ""),
        ),
    );
    const existingTitles = existingNovels.map((n) =>
        (n.title || "").toLowerCase(),
    );

    // Filter out any recommendation that is already scraped
    const unScrapedCandidates = NOVEL_CATALOG.filter((candidate) => {
        const normUrl = candidate.url.toLowerCase().trim().replace(/\/+$/, "");
        if (existingUrls.has(normUrl)) return false;

        // Check if any existing title is closely matching
        const candTitleLower = candidate.title.toLowerCase();
        const isDuplicate = existingTitles.some(
            (exist) =>
                exist.includes(candTitleLower) ||
                candTitleLower.includes(exist),
        );
        return !isDuplicate;
    });

    // Calculate genre weights based on existing library
    const genreScore: Record<string, number> = {
        "Isekai & Fantasy": 0,
        Psychological: 0,
        "Mystery & Historical": 0,
        "Rom-Com & Slice of Life": 0,
        "Action & Dungeon": 0,
    };

    for (const n of existingNovels) {
        const t = (n.title || "").toLowerCase();
        if (
            t.includes("slime") ||
            t.includes("re:zero") ||
            t.includes("isekai") ||
            t.includes("tensei") ||
            t.includes("tamer") ||
            t.includes("seirei") ||
            t.includes("death march") ||
            t.includes("honzuki") ||
            t.includes("bookworm") ||
            t.includes("hero")
        ) {
            genreScore["Isekai & Fantasy"] += 2;
        }
        if (
            t.includes("kyoushitsu") ||
            t.includes("classroom") ||
            t.includes("elite")
        ) {
            genreScore["Psychological"] += 3;
        }
        if (
            t.includes("kusuriya") ||
            t.includes("apothecary") ||
            t.includes("witch") ||
            t.includes("silent")
        ) {
            genreScore["Mystery & Historical"] += 3;
        }
        if (
            t.includes("heroine") ||
            t.includes("makeine") ||
            t.includes("roshia") ||
            t.includes("roshidere") ||
            t.includes("alya")
        ) {
            genreScore["Rom-Com & Slice of Life"] += 3;
        }
        if (
            t.includes("dungeon") ||
            t.includes("danmachi") ||
            t.includes("grimgar") ||
            t.includes("ken")
        ) {
            genreScore["Action & Dungeon"] += 2;
        }
    }

    // Sort candidates so the user's favorite genres appear first
    return unScrapedCandidates.sort((a, b) => {
        const scoreA = genreScore[a.genre] || 0;
        const scoreB = genreScore[b.genre] || 0;
        return scoreB - scoreA;
    });
}
