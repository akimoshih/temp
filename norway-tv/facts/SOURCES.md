# NORWAY in 30s: sources for on-screen facts

As of **2026-09-30**. Generated from `facts/facts.json` by `tmp/facts-edit/build_sources_md.py`. Do not edit by hand; edit the builder and re-run.

## Read this first: verification status

None of the primary web pages could be opened from this production environment. The organisation egress proxy returns 403 for stortinget.no, ssb.no, kartverket.no, lovdata.no, mofa.gov.tw, ey.gov.tw and most news and statistics sites. The shared WebSearch budget is also used up. Every quote below marked *snippet* is the search engine's extract or paraphrase of the named page, not a first-hand read. Derived numbers (distance, ratios, rounding, time zones, midnight-sun dates) were recomputed independently by the fact editor. The log is at `tmp/facts-edit/verify.log`.

**Pre-broadcast checklist (someone with normal internet access):**

- [ ] Open https://www.stortinget.no/globalassets/pdf/representantforslag/2023-2024/dok8-202324-166s.pdf and confirm 'rundt 400 taiwanerne som oppholder seg i Norge'.
- [ ] Open the SSB article and confirm 5 627 400 on 1 Jan 2026 (on-screen 約 563 萬 is robust to ±5,000).
- [ ] Optional: SSB table 05182, landbakgrunn Taiwan, 1 Jan 2026. If available, it becomes the primary Taiwanese number.

Editor re-open attempts on 2026-09-30:

- WebFetch stortinget.no PDF (dok8-202324-166s.pdf): EGRESS_BLOCKED
- curl www.stortinget.no, data.stortinget.no, www.ssb.no, data.ssb.no, kartverket, lovdata, udi, regjeringen, mofa, boca, ocac, ey.gov.tw, stat.gov.tw, eurostat, worldbank, OWID, web.archive.org, nb.no, snl.no, whc.unesco.org, visitnorway.com, visittromso.no, en.seafood.no, ofv.no, norges-bank.no, hdr.undp.org, home-affairs.ec.europa.eu, travel-europe.europa.eu, eeas.europa.eu, no.wikipedia.org, aftenposten.no, indexbox.io, travelmath.com, iana.org, depart.moe.edu.tw: all 403 CONNECT (org egress policy; not retried or routed around). So every cited host was tried and none could be opened.
- WebSearch: session budget used up (200/200); no new searches possible
- GitHub code search for Stortinget and SSB mirrors ('taiwanerne som oppholder seg i Norge', 'Befolkninga steig med 33 100', SSB landbakgrunn Taiwan tables): no national mirror found; only the Karmøy 09817 extract exists

## On-screen lines

| key | on-screen text | footnote | source fact |
|---|---|---|---|
| `capital` | 首都 奧斯陸 Oslo |  | `capital` |
| `population` | 人口 約 563 萬 | SSB 2026.1.1 | `population_latest` |
| `area` | 面積 約 38.5 萬 km² | 含斯瓦巴群島、揚馬延島｜Kartverket·行政院 | `area_total_km2` |
| `area_taiwan_multiple` | 超過 10 個台灣大 | 台灣 36,197 km²（行政院） | `area_ratio_norway_taiwan` |
| `area_mainland_alt` | 本土面積 約 32.4 萬 km² | 不含屬地｜Kartverket·行政院 | `area_mainland_km2` |
| `fjords_unesco` | 峽灣 FJORDS | UNESCO 世界遺產 2005 | `fjords_unesco` |
| `currency` | 貨幣 挪威克朗 NOK |  | `currency` |
| `language` | 語言 挪威語 |  | `languages` |
| `aurora` | 冬季 極光 | Visit Norway | `aurora_season` |
| `midnight_sun` | 夏季 午夜太陽 | Visit Tromsø | `midnight_sun` |
| `taiwanese` | 約 400 人 | 估計值｜挪威國會文件 Dok. 8:166 S（2024） | `taiwanese_in_norway.chosen` |
| `taiwanese_ratio` | 平均每 1.4 萬位挪威居民才 1 位台灣人 | 以人口 563 萬 ÷ 約 400 人估算 | `taiwanese_in_norway.ratio` |
| `taiwanese_share` | 只佔全國人口約 0.007% | 以人口 563 萬 ÷ 約 400 人估算 | `taiwanese_in_norway.ratio` |
| `taiwanese_punchline` | 在挪威遇到台灣人 → 稀有度 ★★★★★ |  | — (humour/copy, no fact) |
| `distance_tpe_osl` | 台北 → 奧斯陸 約 8,700 km | 大圓距離 | `taipei_oslo_distance_km` |
| `time_difference` | 時差 比台灣慢 7 小時 | 夏令時間慢 6 小時 | `time_difference_taiwan` |
| `visa_free` | 台灣護照免簽 90 天 | 申根區·任 180 天內最多 90 天 | `visa_free_taiwan` |
| `ev_share` | 2025 新車 95.9% 是電動車 | OFV 2025 | `ev_share_new_cars` |
| `salmon_exports` | 鮭魚出口 1,247 億克朗 | 挪威海產局 2025 | `salmon_exports_2025` |
| `coastline` | 海岸線 超過 10 萬 km | 含島嶼｜Kartverket 2016 | `coastline_km` |

**End-card credits line:** 資料來源：SSB 挪威統計局 · Kartverket · 行政院 · UNESCO · 挪威國會 Dok. 8:166 S · Visit Norway · Visit Tromsø

**Imagery attributions (SPEC §7, must also be on the end card):**

- Contains modified Copernicus Sentinel data 2023–2025
- Copernicus DEM GLO-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the EU and ESA
- Earth imagery: NASA Blue Marble (via three-globe)

## Taiwanese in Norway (S7 reveal)

**On screen:** 約 400 人 (tag: 估計), footnote: 估計值｜挪威國會文件 Dok. 8:166 S（2024）

**Ratio line:** 平均每 1.4 萬位挪威居民才 1 位台灣人

- Computation: population_latest 5,627,400 / taiwanese 400 = 14,068.5; rounded to the nearest thousand = 14,000 = 1.4 萬
- Rounding: nearest 1,000 (displayed as 1.4 萬). The input is itself approximate ('rundt 400'), so no finer precision is meaningful. Sensitivity: 350 → 1.6 萬, 397 → 1.4 萬, 450 → 1.3 萬.
- Share of population: 0.0071%

**Source:** Stortinget (Norwegian Parliament), Dokument 8:166 S (2023–2024), 'Representantforslag om å styrke Norges bilaterale forhold til Republikken Kina (Taiwan)' (Guri Melby, Ola Elvestuen, Ingvild Wetrhus Thorsvik, Alfred Jens Bjørlo, Venstre)

- Page: <https://www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Representantforslag/2023-2024/dok8-202324-166s/?all=true>
- PDF: <https://www.stortinget.no/globalassets/pdf/representantforslag/2023-2024/dok8-202324-166s.pdf>
- Year: 2024 (Dokument 8:166 S, session 2023–2024; committee report Innst. 37 S (2024–2025); debated in plenary 19 Nov 2024)
- What it counts: An estimate of Taiwanese people living (oppholder seg / bosatt) in Norway, given by the Venstre MPs who wrote a parliamentary proposal. It is not a register count and no method is stated. It most likely counts Taiwan nationals or Taiwan-born residents, probably not Norwegian-born children.
- Quote (Norwegian, as returned by search): «Taiwanere bosatt i Norge oppføres som borgere fra Fastlands-Kina, noe som oppleves grovt fornærmende for de rundt 400 taiwanerne som oppholder seg i Norge.»
- Quote (English search rendering): "Around 400 Taiwanese who reside in Norway are currently listed as citizens of mainland China in the National Registry (Folkeregisteret), which is experienced as deeply offensive to these residents."
- Quote status: Search-engine rendering of the Stortinget page, not a confirmed verbatim quote. stortinget.no is egress-blocked (403) for WebFetch and curl. The fact editor's own re-open attempts on 2026-09-30 (the PDF via WebFetch, the host via curl) were also blocked, and the shared WebSearch budget is used up (200/200).
- Confidence: **medium**

Corroboration:

- Two independent research passes (Chinese angle and Norwegian/English angle) both arrived at about 400 from the same document.
- The Chinese-angle pass saw it in 6 or more separate queries, in Norwegian and English. These included exact-phrase queries ('grovt fornærmende', 'taiwanere som oppholder seg i Norge') that did not contain the number, so the number was not just echoed back from the query.
- The same figure ('approximately 400 Taiwanese living in Norway') appears in search renderings of the plenary debate of 19 Nov 2024, Sak nr. 8.
- The order of magnitude agrees with an unconfirmed search summary of Aftenposten (6 Feb 2013) giving 397.

**Why this number:** Norway has no clean official count. Since 2010 Folkeregisteret and UDI have recorded Taiwanese citizens as citizens of 'Kina'. SSB's national country-of-birth figure for Taiwan could not be reached (ssb.no is blocked), and UN DESA has no Taiwan row for Norway. The most recent and most authoritative figure available is therefore the Norwegian Parliament document Dok. 8:166 S (2024): 'rundt 400 taiwanere'. Two independent research passes found it and it matches the 2013 Aftenposten figure of 397. It is an MPs' estimate, not a statistic, so the screen says 約 400 人 with an 估計 tag, and the footnote names the source and year (SPEC §3). The MOFA text 「僅約百餘人」 is undated and probably outdated, and it counts only long-settled 僑民, so it is not used.

**Fallback wording if the check fails but hundreds is confirmed:** 僅數百人 (估計) / 平均每 1 萬多位挪威居民才 1 位台灣人

### Alternatives considered (not on screen)

- **397**: Taiwanese living in Norway (definition unseen, probably SSB-based) (2013). Aftenposten, 'Slik fornærmer Norge taiwanere' (6 Feb 2013). <https://www.aftenposten.no/verden/i/ArlJ3/slik-fornaermer-norge-taiwanere>
  - Quote: There are 397 Taiwanese people living in Norway, according to an Aftenposten article. [search-tool summary only; the exact-phrase search '397 taiwanere' returned nothing]
  - Reliability: low. Not chosen because: 13 years old; only a search-summary paraphrase that could not be confirmed by an exact-phrase search. It supports the ~400 magnitude only.
- **僅約百餘人 (100+)**: Taiwanese immigrants (僑民) in Norway, long-settled community; definition and date not given (undated (probably before the Taipei office in Oslo closed on 30 Sep 2017)). 中華民國外交部 挪威國情簡介 (text also on zh.wikipedia '中華民國—挪威關係'). <https://www.mofa.gov.tw/CountryInfo.aspx?CASN=1&n=164&sms=33&s=194>
  - Quote: 在挪威的臺灣移民為數不多，僅約百餘人。資深僑民大多經營中小型餐飲業、雜貨小店，或任職於挪威公司。
  - Reliability: low. Not chosen because: Undated and probably old. It counts only settled 僑民, not students or workers. The page is blocked, so the attribution is unconfirmed.
- **None**: SSB immigrants with landbakgrunn Taiwan (country of birth), national total (n/a). SSB StatBank tables 05182 / 05184 / 09817. <https://www.ssb.no/statbank/table/05182/>
  - Quote: Only a municipal mirror was readable: 'Personer	1149 Karmøy	Innvandrere	Taiwan	2024	3' (GitHub mirror of 09817).
  - Reliability: n/a. Not chosen because: The national figure could not be retrieved (ssb.no and data.ssb.no are blocked). The Karmøy value of 3 is probably SSB small-number protection: that extract has no 1s or 2s and many exact 3s. It says nothing about the national count. If someone gets the national 05182 'Taiwan' figure, it should become the primary on-screen number (footnote 'SSB 2026.1.1').
- **None**: UN DESA International Migrant Stock 2024, Norway by origin (2024). UN DESA IMS 2024 (processed JSON mirror on GitHub). <https://raw.githubusercontent.com/Mojtaba-Alehosseini/cs-migration-compass/HEAD/data/processed/un_migrant_stock.json>
  - Quote: NO: China 15,099; China, Hong Kong SAR 2,972; no 'China, Taiwan Province of China' row for Norway (DK has 635)
  - Reliability: high as data, but no figure. Not chosen because: There is no Taiwan row for Norway. This supports the point that Norwegian statistics fold Taiwanese into China.
- **約 4.7 萬 (all Europe)**: OCAC estimate of 臺灣僑民 in all of Europe (France about 12,000); no Norway breakdown (end of 2019 edition). 僑務委員會 僑務統計年報. <https://www.ocac.gov.tw/OCAC/file/attach/313/file_408.pdf>
  - Quote: 歐洲約計有臺灣僑民4萬7千人，占全球臺灣僑民人口數之2.3%，其中以法國1萬2千人為主要僑民地。
  - Reliability: medium for Europe; n/a for Norway. Not chosen because: Not Norway-specific.
- **13**: Taiwanese students in Norway (MOE statistics on students studying abroad) (unknown academic year). 教育部 世界各主要國家之我留學生人數統計. <https://depart.moe.edu.tw/ed2500/News_Content.aspx?n=2D25F01E87D6EE17&sms=4061A6357922F45A&s=DC0431EC04B87EDF>
  - Quote: 丹麥有9名臺灣留學生、挪威有13名、瑞典有149名 [search summary]
  - Reliability: low. Not chosen because: Counts students only; year unknown.
- **10,487 (PRC + ROC combined)**: People from or with origins in the PRC or ROC combined (2016). zh.wikipedia '挪威华人' citing Norwegian statistics. <https://zh.wikipedia.org/zh-hans/%E6%8C%AA%E5%A8%81%E5%8D%8E%E4%BA%BA>
  - Quote: 截至2016年有10,487人来自或祖籍为中华人民共和国或中华民国（台湾） [search summary]
  - Reliability: low. Not chosen because: Not specific to Taiwan.

## All facts

### `population_latest`

- Value: **5627400** persons
- As of: 2026-01-01
- Source: Statistics Norway (SSB), 'Befolkninga steig med 33 100 i 2025' (annual population statistics)
- URL: <https://www.ssb.no/befolkning/folketall/statistikk/befolkning/artikler/befolkninga-steig-med-33-100-i-2025>
- Quote: On January 1, 2026, Norway had a population of 5,627,400 people. ... the population grew by 33,100 people in 2025. [English rendering by the search engine of the Nynorsk SSB article]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **medium**
- Cross-check: Arithmetic: the SSB 1 Jan 2025 figure of 5,594,340 (editor's prior knowledge, not re-fetched) + 33,100 = 5,627,440, which matches 5,627,400 (SSB rounds to the nearest hundred in articles).
- Cross-check: A secondary aggregator (IndexBox) gives 5,633,770 for Q1 2026; that also rounds to 563 萬.
- Note: The exact digits are medium confidence (snippet only). The rounded on-screen value 約 563 萬 is high confidence: any 2026 figure between 5,625,000 and 5,634,999 gives 563 萬.

### `population_q1_2026_secondary`

- Value: **5633770** persons
- As of: 2026-04-01
- Source: IndexBox blog (secondary, presumably from SSB table 01222; not verified)
- URL: <https://www.indexbox.io/blog/norway-population-reaches-5633770-in-q1-2026/>
- Quote: Norway population reaches 5,633,770 in Q1 2026 [URL/headline only; page blocked]
- Quote status: headline/URL only
- Confidence: **low**
- Note: NOT for screen. Cross-check only.

### `area_total_km2`

- Value: **385206** km²
- As of: current Kartverket page (snippet seen 2026-09-30)
- Source: Kartverket (Norwegian Mapping Authority), 'Storleiken på landet'
- URL: <https://www.kartverket.no/en/on-land/fakta-om-norge/storleiken-pa-landet>
- Quote: Fastlands-Noreg 323 807 km², Svalbard (incl. Bjørnøya) 61 022 km², Jan Mayen 377 km², Kongeriket Noreg 385 206 km² [snippet; 323,807 + 61,022 + 377 = 385,206 checks out]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **medium**
- Note: Older SSB/Wikipedia value is 385,207 km². Either way it is 38.52 萬 → on screen 約 38.5 萬 km² (high confidence for the rounded value). Includes Svalbard and Jan Mayen, but not Bouvet Island or the Antarctic claims.

### `area_mainland_km2`

- Value: **323807** km²
- As of: current Kartverket page
- Source: Kartverket, 'Storleiken på landet'
- URL: <https://www.kartverket.no/en/on-land/fakta-om-norge/storleiken-pa-landet>
- Quote: Fastlands-Noreg (mainland Norway): 323 807 km² [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **medium**
- Note: Older value is 323,802 km². Rounds to 約 32.4 萬 km².

### `taiwan_area_km2`

- Value: **36197.3371** km²
- As of: 2026-04-13
- Source: Executive Yuan (行政院) 國情簡介·土地 / 中華民國重要統計數據一覽
- URL: <https://www.ey.gov.tw/state/235266A41238ECCE>
- Quote: 有效管轄土地面積3萬6,197.3371平方公里 [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**
- Note: Taiwan main island + Penghu, Kinmen, Matsu, Dongsha and Nansha. This is a long-standing, stable figure.

### `area_ratio_norway_taiwan`

- Value: **10.64** ratio
- As of: 2026-09-30 (computed)
- Source: Computed from Kartverket and Executive Yuan figures (tmp/facts-edit/verify.log)
- URL: <https://www.kartverket.no/en/on-land/fakta-om-norge/storleiken-pa-landet>
- Quote: 385206 / 36197.3371 = 10.642 (kingdom vs ROC total); 323807 / 36197.3371 = 8.946 (mainland only)
- Quote status: computed by fact editor (independently re-run)
- Confidence: **high**
- Note: The screen compares whole territory with whole territory, which is like-for-like because the Taiwan figure also includes its outlying islands. So the line is 超過 10 個台灣大, which is true since 10.64 > 10 and matches the EDL's 10 stacked Taiwans. For a mainland-only number, use 約 9 個台灣大 (8.95).

### `capital`

- Value: **Oslo (奧斯陸)**
- As of: 2026
- Source: Store norske leksikon, 'Oslo'
- URL: <https://snl.no/Oslo>
- Quote: Oslo is Norway's capital and largest city ... at the innermost part of the Oslofjord [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**

### `currency`

- Value: **Norwegian krone, NOK, symbol kr (挪威克朗)**
- As of: 2026
- Source: Norges Bank (issuer); general references
- URL: <https://www.norges-bank.no/>
- URL the research used: <https://en.wikipedia.org/wiki/Norwegian_krone>
- Quote: The Norwegian Krone is the official currency of Norway ... Its currency code is NOK, and its symbol is kr. ... Norges Bank ... is responsible for issuing [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**
- Note: The research snippet came from en.wikipedia 'Norwegian_krone' (source_url_research). source_url points to the issuer's home page (Norges Bank); no deep link was verified. The fact itself is uncontroversial.

### `languages`

- Value: **Norwegian (norsk; written standards Bokmål and Nynorsk, equal status); Sámi languages are indigenous languages of equal worth (språklova §§ 1, 5; sameloven ch. 3)**
- As of: 2022-01-01 (Language Act in force)
- Source: Lov om språk (språklova), LOV-2021-05-21-42, Lovdata
- URL: <https://lovdata.no/dokument/NL/lov/2021-05-21-42>
- Quote: Norsk er det nasjonale hovudspråket i Noreg ... Samiske språk er urfolksspråk i Noreg ... bokmål og nynorsk er likeverdige [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**

### `fjords_unesco`

- Value: **2005** year inscribed
- As of: 2005
- Source: UNESCO World Heritage Centre, 'West Norwegian Fjords – Geirangerfjord and Nærøyfjord' (site 1195)
- URL: <https://whc.unesco.org/en/list/1195/>
- Quote: The West Norwegian Fjords: Geirangerfjord and Nærøyfjord were designated as a UNESCO World Heritage Site in 2005 ... criteria vii and viii [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**

### `aurora_season`

- Value: **late September – late March (Northern Norway, dark and clear skies)** months
- As of: 2026
- Source: Visit Norway (official travel guide), 'The best time to see the northern lights'
- URL: <https://www.visitnorway.com/things-to-do/nature-attractions/northern-lights/best-time-to-see/>
- Quote: the northern lights can usually be seen from late September until late March when the sky is dark and clear [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**

### `midnight_sun`

- Value: **Tromsø about 20 May – 22 July; North Cape about 14 May – 29 July** dates
- As of: annual
- Source: Visit Tromsø, 'Midnight Sun in Tromsø'; Visit Norway, 'The North Cape'
- URL: <https://www.visittromso.no/midnight-sun>
- Quote: Midnight sun in Tromsø usually lasts from around 20 May to 22 July. / The sun is up for 24 hours per day between 14 May and 29 July at the North Cape. [snippets]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**
- Cross-check: Editor's astronomical check (NOAA declination, flat horizon, −0.833° refraction and semi-diameter) gives Tromsø 69.65°N 19 May–25 Jul and Nordkapp 12 May–1 Aug. The published ranges sit inside these, so they are conservative once terrain is allowed for. Consistent.

### `coastline_km`

- Value: **100915** km
- As of: 2016-10-10 (Kartverket calculation)
- Source: Kartverket (Statens kartverk), via no.wikipedia 'Norskekysten'
- URL: <https://no.wikipedia.org/wiki/Norskekysten>
- Quote: Fastland 28 953 km, øyer 71 963 km, totalt 100 915 km [snippet paraphrase]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either. Secondary (Wikipedia citing Kartverket).
- Confidence: **medium**
- Note: The older figure of 25,148 km for the mainland is superseded. 100,915 / 40,075 = 2.52 → 繞地球約 2.5 圈. Optional extra; not in the EDL.

### `time_difference_taiwan`

- Value: **Taiwan is 7 h ahead of Norway (CET); 6 h ahead during Norwegian summer time (29 Mar – 25 Oct 2026)** hours
- As of: 2026
- Source: IANA tz database (Asia/Taipei vs Europe/Oslo), computed with Python zoneinfo (tzdata 2025b)
- URL: <https://www.iana.org/time-zones>
- Quote: 2026-01-15 diff 7.0 h; 2026-03-30 diff 6.0 h; 2026-10-26 diff 7.0 h (tmp/facts-edit/verify.log)
- Quote status: computed by fact editor
- Confidence: **high**

### `taipei_oslo_distance_km`

- Value: **8694** km
- As of: 2026-09-30 (computed)
- Source: Great-circle computation by the fact editor (haversine R = 6371.0088 km; Vincenty WGS84), Taipei 101 (25.0330N 121.5654E) → Oslo S (59.9111N 10.7528E)
- URL: <https://www.travelmath.com/distance/from/Taipei,+Taiwan/to/Oslo,+Norway>
- Quote: haversine 8694.0 km; WGS84 ellipsoid 8709.7 km; airports TPE→OSL 8641.2 km (sphere) / 8656.8 km (WGS84). Travelmath: 'approximately 8,707 kilometers' [snippet]
- Quote status: computed by fact editor (independently re-run; matches the research team's calc.log)
- Confidence: **high**
- Note: The figure depends on the method (8,641–8,710 km), so the screen shows 約 8,700 km, which holds for every method.

### `visa_free_taiwan`

- Value: **ROC (Taiwan) passport holders (passport showing a national ID number): visa-free short stays in Norway/Schengen, max 90 days in any 180-day period** days
- As of: 2026
- Source: EEAS – European Economic and Trade Office in Taiwan, 'Travel & Study'; UDI; 外交部領事事務局
- URL: <https://www.eeas.europa.eu/delegations/taiwan/travel-study_en>
- Quote: For short-term visits of up to 90 days within a period of 180 days, no visa is needed by holders of Taiwanese passports ... (Iceland, Liechtenstein, Norway and Switzerland) [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **high**
- Note: Optional extra. Do not put ETIAS dates on screen.

### `etias_ees_status`

- Value: **EES fully operational since 2026-04-10; ETIAS not yet operational, no confirmed launch date as of Sep 2026**
- As of: 2026-09
- Source: European Commission DG HOME (EES news 2026-04-10); travel press
- URL: <https://home-affairs.ec.europa.eu/news/entryexit-system-ees-fully-operational-2026-04-10_en>
- Quote: The Entry/Exit System (EES) is fully operational ... / ... removed the 'last quarter of 2026' launch window [snippets]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **low**
- Note: Background only. NOT for screen; the status changes too fast.

### `ev_share_new_cars`

- Value: **95.9** % of new passenger cars fully electric
- As of: 2025 full year
- Source: OFV (Opplysningsrådet for veitrafikken), '2025 ble tidenes rekordår for bilsalget' (2 Jan 2026)
- URL: <https://ofv.no/aktuelt/2026/2025-ble-tidenes-rekord%C3%A5r-for-bilsalget>
- Quote: Elbiler utgjorde 95,9 prosent av alle nye biler som ble registrert i 2025. [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **medium**
- Note: Optional 'did you know' extra. 2026 YTD (Jan–Aug) is reportedly 97.8% (snippet only; not for screen).

### `salmon_exports_2025`

- Value: **124.7** billion NOK
- As of: 2025 full year
- Source: Norwegian Seafood Council (Sjømatrådet), annual export press release (Jan 2026)
- URL: <https://en.seafood.no/news-and-media/news-archive/price-growth-for-wild-fish-and-increased-salmon-volume-resulted-in-record-value-for-norwegian-seafood-exports-in-2025-/>
- Quote: Salmon made up NOK 124.7 billion worth of Norway's seafood export value in 2025 ... total NOK 181.5 billion [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **medium**
- Note: Optional extra.

### `hdi_rank`

- Value: **2** rank (HDI 0.970, tied with Switzerland; Iceland 1st at 0.972)
- As of: HDR 2025 (2023 data)
- Source: UNDP Human Development Report 2025, Statistical Annex Table 1
- URL: <https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Statistical_Annex_HDI_Table.pdf>
- Quote: Iceland (0.972), Switzerland (0.970), and Norway (0.970) top the Human Development Index [snippet]
- Quote status: search-engine snippet of the named page; the page itself was not opened (host egress-blocked, 403). The fact editor could not open it again on 2026-09-30 either.
- Confidence: **medium**
- Note: NOT for screen: Norway is no longer #1, so the fact has little punch.

