# Competitor landscape — who else tracks what figures say

## Key insights

- PolitiFact has tracked flip-flops since 2008 (Flip-O-Meter) — but editorial, case-by-case; no browsable per-figure corpus
- Nobody ships a per-figure statement timeline; C-SPAN's person pages come closest, and C-SPAN is in financial crisis
- The X/Twitter API shutdown killed both politician-tweet archives (Politwoops, PolitiTweet) — platform dependence is the top cause of death
- Full Fact already runs AI that alerts when an MP repeats a debunked claim — the closest live tech to automated inconsistency detection
- WaPo's 30,573-claim Trump database was frozen in Jan 2021 and never restarted; its editor left in 2025 with no successor named
- Commercial monitors (Meltwater, Cision, NewsWhip) sell private alerts to PR teams, not public per-figure histories — the niche is open
- No project found that combines a scraped sourced corpus, automated contradiction detection, and public per-figure browsing

## Public fact-checkers

**PolitiFact** is the most direct precedent for inconsistency tracking. Its [Flip-O-Meter, introduced in 2008](https://www.politifact.com/article/2008/aug/05/introducing-flip-o-meter/), rates an official's *consistency* on an issue — No Flip / Half Flip / Full Flop — explicitly framed as not a value judgment about changing positions. It is still in active use: PolitiFact ran a [Full Flop on Trump's TikTok-ban reversal in January 2025](https://www.politifact.com/factchecks/2025/jan/16/donald-trump/flip-flop-trump-now-opposes-a-tiktok-ban-in-2020-h/), and maintains a [rolling list of Full Flop rulings](https://www.politifact.com/factchecks/list/?ruling=full-flop). The crucial limitation: it's editorial and case-by-case — a reporter writes each Flip-O-Meter item like a fact-check ([same process as the Truth-O-Meter](https://www.politifact.com/article/2013/may/31/principles-politifact/)); there is no continuously maintained per-figure statement corpus behind it. PolitiFact also runs promise trackers for the fourth presidency in a row — the [MAGA-Meter](https://www.politifact.com/article/2025/jan/19/politifact-donald-trump-2024-promises-maga-meter/) tracks ~75 second-term promises with Kept/Broken/Compromise/Stalled ratings.

**FactCheck.org** is alive and stable, [funded by the Annenberg Public Policy Center](https://www.annenbergpublicpolicycenter.org/political-communication/factcheck-org/) (endowment-backed since 1993). Its [Meta partnership ended in January 2025](https://www.factcheck.org/2025/01/our-partnership-with-meta-is-ending/) but it stated it will continue on grants and donations. No figure-over-time tracking beyond tag archives.

**Snopes** is alive, [owned by Chris Richmond and Drew Schoentrup and funded by programmatic ads, memberships, contributions and merchandise](https://www.snopes.com/disclosures/); its newsroom [announced a union in July 2025](https://objectivejournalism.org/2025/07/snopes-the-internets-oldest-dedicated-fact-checking-organization-announces-intent-to-unionize/). It fact-checks claims, not figures; no longitudinal tracking.

**Full Fact** (UK) is the technology leader. It has [three main AI tools: claim detection, repeated-claim alerts, and live TV/radio transcription cross-referenced against its fact-check library](https://fullfact.org/blog/2025/feb/how-ai-can-help-fact-checkers/) — the alerts let it contact an MP who keeps repeating a debunked claim, which is functionally repeat-inconsistency detection. Its claim-matching system [runs ~10 million sentence comparisons daily](https://newsmachines.beehiiv.com/p/how-full-fact-scales-human-fact-checking-with-ai-1), and the tools are [used by 40+ fact-checking organizations in 30+ countries, including for US election coverage](https://www.poynter.org/fact-checking/2025/the-uks-fact-checkers-are-sending-their-ai-to-help-americans-cover-elections/). What it doesn't do: publish a browsable per-figure statement history for the public.

**AP Fact Check** — status **unverified**. AP [stopped fact-checking for Facebook at the end of 2018](https://techcrunch.com/2019/02/01/snopes-and-ap-leave-facebook-fact-checking-partnership/) and its [IFCN signatory application exists on Poynter](https://ifcncodeofprinciples.poynter.org/application/public/ap-fact-check/3E3B10E8-15FA-931D-E3DB-2DBEAA35527B), but this pass found no reliable source confirming or denying that AP shut its standalone fact-check vertical (Poynter.org is egress-blocked from this environment). Flagged in open questions.

**Washington Post Fact Checker** — the [Trump claims database](https://www.washingtonpost.com/graphics/politics/trump-claims-database/) is the largest per-figure claim corpus ever built by a newsroom: [30,573 false or misleading claims over four years, archived on Jan 20, 2021](https://www.washingtonpost.com/politics/2021/01/24/trumps-false-or-misleading-claims-total-30573-over-four-years/) and never restarted for the second term ([methodology retrospective](https://www.washingtonpost.com/politics/how-fact-checker-tracked-trump-claims/2021/01/23/ad04b69a-5c1d-11eb-a976-bad6431e03e2_story.html)). Glenn Kessler, its editor for ~15 years, [took a buyout and left July 31, 2025](https://washingtoncitypaper.com/article/768821/fact-checker-glenn-kessler-exits-washington-post-buyout/), [saying he's "not sure" the paper will replace the role](https://www.thewrap.com/washington-post-fact-checker-exits/) ([his own account](https://glennkessler.substack.com/p/why-i-left-the-washington-post)). Lesson: even the flagship per-figure database was a manual, single-figure, single-newsroom effort that died with staffing changes.

**Industry-wide status**: the IFCN's [State of the Fact-Checkers 2025 report](https://www.poynter.org/wp-content/uploads/2026/03/2026-State-of-Fact-Checkers-4.pdf) ([Rappler summary](https://www.rappler.com/world/global-affairs/state-fact-checkers-report-2025-ifcn/)) found 45.3% suffered revenue declines after the Meta and USAID withdrawals, 76% described finances as vulnerable or in crisis — yet 62% grew audiences. Duke's [2026 census](https://reporterslab.org/2026/06/12/2026-census-fact-checking-losses-continue-amid-funding-pressure-but-most-projects-persist/) counts 437 active fact-checkers by mid-2026; in 2025, 30 outlets stopped publishing versus 10 new ones. (Both domains egress-blocked here; figures via search snippets and Rappler.)

## Civic-data / transparency platforms

| Platform | Tracks statements by figure? | Status 2026 |
|---|---|---|
| GovTrack | Votes/bills, not statements | Alive, tiny/indie |
| OpenSecrets | Money, not statements | Alive, ~1/3 staff cut Nov 2024 |
| Ballotpedia | Position snapshots, not timelines | Alive, well-funded |
| ProPublica Represent/Congress API | Votes | **Dead** (July 2024) |
| C-SPAN archive | Per-person appearance video since 1987 | Alive, financially squeezed |
| Vote Smart | Positions via questionnaire + votes | Alive (shutdown rumor unconfirmed) |
| ISideWith | Position comparisons | Alive |
| Polimeter (Trudeaumetre) | Promises, methodically | Alive (academic) |
| Politwoops / PolitiTweet | Deleted tweets by figure | **Dead** (2023, X API) |

**GovTrack.us** is [wholly independent (Civic Impulse LLC), funded by ads, Substack subscriptions and crowdfunding, with a few part-time staff](https://www.govtrack.us/about) — it even ran a [2025 Kickstarter ($65,874 from 1,099 backers) just to add executive-order alerts](https://www.kickstarter.com/projects/govtrack/alert-new-executive-order). It tracks votes and bills, not statements. **OpenSecrets** — formed by the [2021 merger of the Center for Responsive Politics and the National Institute on Money in Politics](https://www.opensecrets.org/news/2021/05/opensecrets-merger-press-release) — [laid off 10 staff (~a third, including much of the research team) in November 2024](https://www.commondreams.org/news/opensecrets) despite a $16B election cycle. **Ballotpedia** is the healthy outlier: [674,283 articles written by paid professional staff, sponsored by the Lucy Burns Institute](https://ballotpedia.org/Ballotpedia:About) — but it stores position *snapshots*, not statement timelines. **ProPublica's Represent and the Congress API** [closed effective July 10, 2024](https://www.propublica.org/datastore/api/propublica-congress-api).

**C-SPAN** is the sleeping giant: [everything preserved since September 1987, 230,000+ hours searchable by speaker](https://newsbreaks.infotoday.com/NewsBreaks/CSPAN-Video-Archive-Goes-Online-66173.asp), and every person who's ever appeared has a bio page listing all appearances ([Video Library](https://www.c-span.org/30-years/)) — the closest existing thing to a per-figure public-statement archive, though video-indexed, not claim-indexed. It is in [financial trouble: revenue fell from ~$64M (2019) to $45.4M (2023) as cable dies](https://broadbandbreakfast.com/senators-urge-streaming-providers-to-carry-c-span/); [YouTube TV and Hulu agreed to carry it only in September 2025 after Senate pressure](https://www.wyden.senate.gov/news/press-releases/wyden-applauds-victory-for-c-span-after-pressure-from-wyden-youtube-tv-and-hulu-agree-to-carry-government-access-channel-in-streaming-packages).

**Vote Smart** appears to still be operating — [its site is live](https://justfacts.votesmart.org/) and [LeadIQ lists ~46 employees as of April 2026](https://leadiq.com/c/votesmart/5a1da6c22300005b009a0dd5); no shutdown announcement was found. Its [Political Courage Test](https://justfacts.votesmart.org/about/political-courage-test/) asks candidates to state positions directly, but [incumbents have long snubbed it](https://www.reviewjournal.com/news/incumbents-snub-political-courage-test/) — when candidates won't answer, Vote Smart infers positions from votes and public statements. It has had financial scares before ([2014 layoffs, considered closing](https://missoulian.com/news/local/project-vote-smart-lays-off-6-considers-closing/article_0ec6e3b0-b169-11e3-95b7-001a4bcf887a.html)). **ISideWith** is [alive with 2025/2026 quizzes and voter guides](https://www.isidewith.com/elections/2025). **Polimeter** (Université Laval's CAPP/CLESSN) is the methodological gold standard for promise tracking — [578 Trudeau promises identified for the 2021 mandate](https://www.newswire.ca/news-releases/polimeter-trudeau-3-0-a-record-of-578-promises-to-track-831587771.html), with [explicit verdict criteria distinguishing it from the crowdsourced TrudeauMeter](https://www.poltext.org/en/comparison-trudeaumeter-questions-and-answers) and [coverage through the 44th Parliament](https://www.polimeter.org/en/trudeau?c%5B%5D=122&gb=status&sb=alpha_asc). **TrumpTracker** ([trumptracker.github.io](https://trumptracker.github.io/)) was a volunteer open-source first-term promise tracker; the [repo](https://github.com/TrumpTracker/trumptracker.github.io) shows no sign of second-term activity — effectively dormant.

**The deleted-tweet graveyard** is the sharpest cautionary tale. ProPublica's **Politwoops** (inherited from the Sunlight Foundation in 2016) archived 500k+ deleted politician tweets; after Musk's takeover X disabled the deletion-tracking API and [Politwoops "is no more" (Nieman Lab, Feb 2023)](https://www.niemanlab.org/2023/02/after-a-decade-of-tracking-politicians-deleted-tweets-politwoops-is-no-more/) — [the ProPublica page now serves only an unmaintained partial snapshot](https://projects.propublica.org/politwoops/). **PolitiTweet** ([polititweet.org](https://polititweet.org/)), which archived full timelines of ~1,500 public figures, [stopped archiving on April 3, 2023 when Twitter cut API access](https://polititweet.org/about) and persists as a frozen archive. Twitter had also [mass-revoked 30 international Politwoops sites' API access once before, in 2015](https://www.cbsnews.com/sanfrancisco/news/twitter-shuts-down-30-sites-keeping-tabs-on-politicians-by-publicizing-deleted-tweets/). Lesson: single-platform API dependence killed every project in this cluster twice.

## Commercial media monitoring

None of the majors surfaced a public per-figure statement-history product; they sell private, real-time alerting to PR and comms teams. [Meltwater](https://www.meltwater.com/en/capabilities/media-intelligence) covers news/social/print/broadcast/podcasts with AI dashboards; [Cision (CisionOne) is built around PR workflows — monitoring plus journalist outreach and PR Newswire distribution](https://prowly.com/magazine/cision-vs-meltwater/). **NewsWhip** was [acquired by Sprout Social on July 29, 2025 for $55M cash plus up to $10M earn-outs](https://investors.sproutsocial.com/news/news-details/2025/Sprout-Social-Acquires-NewsWhip-Enhancing-Predictive-Intelligence-Capabilities-and-Accelerating-AI-Roadmap/default.aspx), shortly after [launching an "AI media monitoring agent"](https://www.irishtimes.com/business/2025/07/17/newswhip-unveils-ai-media-monitoring-agent/) — consolidation, not death. [Factiva (Dow Jones) aggregates 32,000+ sources including TV/radio transcripts](https://about.proquest.com/en/products-services/factiva/) — searchable by person via Dow Jones indexing, but a research database, not a statement timeline. [TVEyes](https://www.tveyes.com/) is broadcast-monitoring SaaS [marketed directly to campaigns for tracking candidate coverage and clipping](https://www.tveyes.com/playbook-broadcast-monitoring-for-elections-2/). The takeaway: the *capability* (continuous per-figure media capture) exists commercially, but as ephemeral private alerts priced for enterprises — no one has productized a public, citable, longitudinal corpus.

## Direct precedents and the startup graveyard

- **Logically** (UK, founded 2017, raised big to do AI fact-checking at scale): [filed for administration in July 2025 after losing its TikTok and Meta contracts](https://sifted.eu/articles/logically-ai-fact-check-misinformation-trump-tiktok-meta), following [February 2025 layoffs](https://bebeez.eu/2025/07/06/fact-checker-logically-files-for-administration-after-losing-tiktok-and-meta-contracts/); its assets were [sold in a pre-pack deal to Kreatur Ltd, run by a former director](https://businesscloud.co.uk/news/rise-fall-of-yorkshire-firm-sold-in-pre-pack-administration-deal/) ([UKTN](https://www.uktech.news/ai/ai-fact-checker-logically-sold-off-in-administration-deal-20250707)). Lesson: platform-moderation contracts were a concentrated revenue base that evaporated with the political wind.
- **Storyzy** (Paris) [launched as an automated quote verifier — detecting fake quotes attributed to public figures](https://techcrunch.com/2017/06/02/storyzy-is-a-quote-verifier-that-wants-to-skewer-fake-news/) — the closest startup precedent to a statement corpus. It [pivoted to brand-safety / blocking ads on disinformation sites](https://www.cbinsights.com/company/storyzy). Quote verification alone didn't find a business.
- **Trive** (blockchain crowdsourced fact-checking token, [2017 token pre-sale](https://www.prweb.com/releases/live_pre_sale_of_trive_fights_fake_news_using_cryptocurrency_and_crowdsourced_research/prweb14810397.htm)) — no evidence of current operations found; presumed dead (unverified).
- **Factiverse** (Norway, founded 2019): alive but tiny — [raised ~€1M with a seed round planned for 2025](https://techcrunch.com/2024/11/17/norwegian-startup-factiverse-wants-to-fight-disinformation-with-ai/); repositioning toward checking AI hallucinations ([TNW](https://thenextweb.com/news/fact-checking-startup-factiverse-targets-ai-hallucinations)).
- **Parafact** ([parafactai.com](https://parafactai.com/)) and [Originality.ai's Automated Fact Checker](https://originality.ai/automated-fact-checker) are claim-verification APIs for *writers* — text-in, citations-out; neither tracks figures over time.

No project was found that combines all three of hitbut's layers (scraped sourced corpus + automated contradiction/shift detection + public per-figure browsing). The pieces each exist separately: WaPo proved the per-figure claim database (manually, one figure), PolitiFact proved the flip-flop verdict format (editorially), Full Fact proved automated repeat-claim matching (privately, for fact-checkers), C-SPAN holds the raw per-figure archive (video, unclaim-indexed).

## Sources

- [Introducing the Flip-O-Meter — PolitiFact](https://www.politifact.com/article/2008/aug/05/introducing-flip-o-meter/)
- [Principles of PolitiFact — PolitiFact](https://www.politifact.com/article/2013/may/31/principles-politifact/)
- [Trump TikTok Full Flop — PolitiFact](https://www.politifact.com/factchecks/2025/jan/16/donald-trump/flip-flop-trump-now-opposes-a-tiktok-ban-in-2020-h/)
- [Full Flop rulings list — PolitiFact](https://www.politifact.com/factchecks/list/?ruling=full-flop)
- [MAGA-Meter launch — PolitiFact](https://www.politifact.com/article/2025/jan/19/politifact-donald-trump-2024-promises-maga-meter/)
- [Meta partnership ending — FactCheck.org](https://www.factcheck.org/2025/01/our-partnership-with-meta-is-ending/)
- [FactCheck.org at APPC — Annenberg Public Policy Center](https://www.annenbergpublicpolicycenter.org/political-communication/factcheck-org/)
- [Snopes disclosures — Snopes](https://www.snopes.com/disclosures/)
- [Snopes Guild — Objective Journalism](https://objectivejournalism.org/2025/07/snopes-the-internets-oldest-dedicated-fact-checking-organization-announces-intent-to-unionize/)
- [How AI can help fact checkers — Full Fact](https://fullfact.org/blog/2025/feb/how-ai-can-help-fact-checkers/)
- [Full Fact claim matching scale — News Machines](https://newsmachines.beehiiv.com/p/how-full-fact-scales-human-fact-checking-with-ai-1)
- [Full Fact AI in US elections — Poynter](https://www.poynter.org/fact-checking/2025/the-uks-fact-checkers-are-sending-their-ai-to-help-americans-cover-elections/)
- [AP Fact Check IFCN application — Poynter IFCN](https://ifcncodeofprinciples.poynter.org/application/public/ap-fact-check/3E3B10E8-15FA-931D-E3DB-2DBEAA35527B)
- [Snopes/AP leave Facebook — TechCrunch](https://techcrunch.com/2019/02/01/snopes-and-ap-leave-facebook-fact-checking-partnership/)
- [Trump claims database — Washington Post](https://www.washingtonpost.com/graphics/politics/trump-claims-database/)
- [30,573 claims total — Washington Post](https://www.washingtonpost.com/politics/2021/01/24/trumps-false-or-misleading-claims-total-30573-over-four-years/)
- [How the Fact Checker tracked Trump claims — Washington Post](https://www.washingtonpost.com/politics/how-fact-checker-tracked-trump-claims/2021/01/23/ad04b69a-5c1d-11eb-a976-bad6431e03e2_story.html)
- [Kessler exits in buyout — Washington City Paper](https://washingtoncitypaper.com/article/768821/fact-checker-glenn-kessler-exits-washington-post-buyout/)
- [Kessler "not sure" of replacement — TheWrap](https://www.thewrap.com/washington-post-fact-checker-exits/)
- [Why I left the Post — Glenn Kessler, Substack](https://glennkessler.substack.com/p/why-i-left-the-washington-post)
- [State of the Fact-Checkers 2025 report — Poynter/IFCN PDF](https://www.poynter.org/wp-content/uploads/2026/03/2026-State-of-Fact-Checkers-4.pdf) (domain egress-blocked; via search snippets)
- [IFCN report summary — Rappler](https://www.rappler.com/world/global-affairs/state-fact-checkers-report-2025-ifcn/)
- [2026 fact-checking census — Duke Reporters' Lab](https://reporterslab.org/2026/06/12/2026-census-fact-checking-losses-continue-amid-funding-pressure-but-most-projects-persist/) (domain egress-blocked; via search snippets)
- [About GovTrack — GovTrack.us](https://www.govtrack.us/about)
- [GovTrack EO-alert Kickstarter — Kickstarter](https://www.kickstarter.com/projects/govtrack/alert-new-executive-order)
- [CRP/NIMP merger — OpenSecrets](https://www.opensecrets.org/news/2021/05/opensecrets-merger-press-release)
- [OpenSecrets lays off 1/3 of staff — Common Dreams](https://www.commondreams.org/news/opensecrets)
- [About Ballotpedia — Ballotpedia](https://ballotpedia.org/Ballotpedia:About)
- [Congress API closure notice — ProPublica](https://www.propublica.org/datastore/api/propublica-congress-api)
- [C-SPAN archive online — Information Today](https://newsbreaks.infotoday.com/NewsBreaks/CSPAN-Video-Archive-Goes-Online-66173.asp)
- [30 years of the Video Library — C-SPAN](https://www.c-span.org/30-years/)
- [C-SPAN finances/carriage — Broadband Breakfast](https://broadbandbreakfast.com/senators-urge-streaming-providers-to-carry-c-span/)
- [YouTube TV/Hulu carry C-SPAN — Sen. Wyden press release](https://www.wyden.senate.gov/news/press-releases/wyden-applauds-victory-for-c-span-after-pressure-from-wyden-youtube-tv-and-hulu-agree-to-carry-government-access-channel-in-streaming-packages)
- [Vote Smart site — Vote Smart](https://justfacts.votesmart.org/)
- [Political Courage Test — Vote Smart](https://justfacts.votesmart.org/about/political-courage-test/)
- [Vote Smart employee count — LeadIQ](https://leadiq.com/c/votesmart/5a1da6c22300005b009a0dd5)
- [Incumbents snub courage test — Las Vegas Review-Journal](https://www.reviewjournal.com/news/incumbents-snub-political-courage-test/)
- [2014 layoffs — Missoulian](https://missoulian.com/news/local/project-vote-smart-lays-off-6-considers-closing/article_0ec6e3b0-b169-11e3-95b7-001a4bcf887a.html)
- [2025 voter guide — ISideWith](https://www.isidewith.com/elections/2025)
- [Trudeau Polimeter 3.0 — Newswire.ca / Université Laval](https://www.newswire.ca/news-releases/polimeter-trudeau-3-0-a-record-of-578-promises-to-track-831587771.html)
- [Polimeter vs TrudeauMeter — POLTEXT](https://www.poltext.org/en/comparison-trudeaumeter-questions-and-answers)
- [Trudeau Polimeter — Polimeter.org](https://www.polimeter.org/en/trudeau?c%5B%5D=122&gb=status&sb=alpha_asc)
- [Trump Tracker site](https://trumptracker.github.io/) and [repo — GitHub](https://github.com/TrumpTracker/trumptracker.github.io)
- [Politwoops is no more — Nieman Lab](https://www.niemanlab.org/2023/02/after-a-decade-of-tracking-politicians-deleted-tweets-politwoops-is-no-more/)
- [Politwoops archive page — ProPublica](https://projects.propublica.org/politwoops/)
- [PolitiTweet about/status — PolitiTweet](https://polititweet.org/about)
- [Twitter cuts 30 Politwoops sites, 2015 — CBS News](https://www.cbsnews.com/sanfrancisco/news/twitter-shuts-down-30-sites-keeping-tabs-on-politicians-by-publicizing-deleted-tweets/)
- [Media intelligence — Meltwater](https://www.meltwater.com/en/capabilities/media-intelligence)
- [Cision vs Meltwater comparison — Prowly](https://prowly.com/magazine/cision-vs-meltwater/)
- [Sprout acquires NewsWhip — Sprout Social IR](https://investors.sproutsocial.com/news/news-details/2025/Sprout-Social-Acquires-NewsWhip-Enhancing-Predictive-Intelligence-Capabilities-and-Accelerating-AI-Roadmap/default.aspx)
- [NewsWhip sold for $55M+ — Irish Times](https://www.irishtimes.com/business/2025/07/30/irish-founded-newswhip-sold-for-at-least-55m/)
- [NewsWhip AI agent — Irish Times](https://www.irishtimes.com/business/2025/07/17/newswhip-unveils-ai-media-monitoring-agent/)
- [Factiva overview — ProQuest/Dow Jones](https://about.proquest.com/en/products-services/factiva/)
- [TVEyes](https://www.tveyes.com/) and [broadcast monitoring for elections — TVEyes](https://www.tveyes.com/playbook-broadcast-monitoring-for-elections-2/)
- [Logically files for administration — Sifted](https://sifted.eu/articles/logically-ai-fact-check-misinformation-trump-tiktok-meta)
- [Logically administration/layoffs — BeBeez](https://bebeez.eu/2025/07/06/fact-checker-logically-files-for-administration-after-losing-tiktok-and-meta-contracts/)
- [Rise & fall of Logically — BusinessCloud](https://businesscloud.co.uk/news/rise-fall-of-yorkshire-firm-sold-in-pre-pack-administration-deal/)
- [Logically sold in administration — UKTN](https://www.uktech.news/ai/ai-fact-checker-logically-sold-off-in-administration-deal-20250707)
- [Storyzy quote verifier — TechCrunch](https://techcrunch.com/2017/06/02/storyzy-is-a-quote-verifier-that-wants-to-skewer-fake-news/)
- [Storyzy profile/pivot — CB Insights](https://www.cbinsights.com/company/storyzy)
- [Trive token pre-sale — PRWeb](https://www.prweb.com/releases/live_pre_sale_of_trive_fights_fake_news_using_cryptocurrency_and_crowdsourced_research/prweb14810397.htm)
- [Factiverse profile — TechCrunch](https://techcrunch.com/2024/11/17/norwegian-startup-factiverse-wants-to-fight-disinformation-with-ai/)
- [Factiverse targets hallucinations — TNW](https://thenextweb.com/news/fact-checking-startup-factiverse-targets-ai-hallucinations)
- [Parafact](https://parafactai.com/)
- [Automated Fact Checker — Originality.ai](https://originality.ai/automated-fact-checker)

## Open questions

- AP Fact Check's standalone vertical: confirm whether AP still runs a dedicated fact-check desk in 2026 (Poynter.org egress-blocked here; needs an unblocked environment or a human).
- Vote Smart's health: LeadIQ says ~46 staff (Apr 2026) but no primary source confirms; check IRS 990s and Political Courage Test response-rate trend.
- Full Fact's claim-matching tools: are they licensable/open, and could hitbut build on rather than compete with them? (positioning input, deferred pass)
- WaPo Trump database: is the underlying claim-level data publicly downloadable for academic reuse? Would be a seed corpus / benchmark.
- Kreatur (Logically's buyer): what did it actually keep running, and does anything statement-tracking survive there?
- Commercial gap check: do Politico Pro-style tools or Signal-AI-type products quietly offer per-figure quote histories to lobbyists? Only surface-checked here.
- C-SPAN partnership/licensing: what are the terms for programmatic use of the Video Library and its transcripts? Directly feeds corpus-sourcing strategy.
- Positioning read (explicitly deferred): which lesson dominates — distribution-dependence (Politwoops, Logically) or funding-model fragility (OpenSecrets, WaPo)?

## Growth log

- **2026-08-21** — Page seeded (initial research scan, deferred at adoption): surveyed public fact-checkers (with current 2025/2026 status), civic-data platforms including the deleted-tweet graveyard, commercial media monitoring, and the direct-precedent startup graveyard; established that no live product combines hitbut's three layers.
