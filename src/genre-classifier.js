'use strict';

const { themeFor } = require('./themes');
const { canonicalizeGenreLabel } = require('./genre-localization');

const ASMR_SIGNAL_PATTERN = /(?:\basmr\b|助眠|哄睡|睡前陪伴|睡眠(?:音乐|音樂|音效|引导|引導)|深度睡眠|白噪(?:音|声|聲)|采耳|耳部(?:护理|護理)|睡眠導入|睡眠用(?:bgm|音楽|サウンド)|安眠|快眠|眠れる|耳かき|囁き(?:声)?|ささやき(?:声)?|ホワイトノイズ|\b(?:sleep sounds?|sleep aid|deep sleep|bedtime sounds?|binaural (?:sleep|relaxation)|ear cleaning|white noise|brown noise|pink noise)\b)/i;

const RULES = [
  ['asmr', ASMR_SIGNAL_PATTERN],
  ['hard-dance', /\b(hard dance)\b/i],
  ['puzzycore', /\b(puzzycore|puzzy core)\b/i],
  ['uptempo-hardcore', /\b(uptempo(?: hardcore)?|terrorcore|terror core|speedcore)\b/i],
  ['uk-hardcore', /\b(uk hardcore|ukcore|freeform hardcore)\b/i],
  ['happy-hardcore', /\b(happy hardcore)\b/i],
  ['industrial-hardcore', /\b(industrial hardcore|darkcore|doomcore)\b/i],
  ['frenchcore', /\b(frenchcore)\b/i],
  ['gabber', /\b(gabber|mainstream hardcore|early hardcore)\b/i],
  ['hardcore', /\b(hardcore techno|hardcore edm|j[\s-]?core|kawaii hardcore|hardcore)\b/i],
  ['rawstyle', /\b(rawstyle|raw hardstyle|xtra raw|rawphoric)\b/i],
  ['euphoric-hardstyle', /\b(euphoric hardstyle|euphoric)\b/i],
  ['hardstyle', /\b(hardstyle|reverse bass)\b/i],
  ['future-riddim', /\b(future riddim)\b/i],
  ['colour-bass', /\b(colour bass|color bass)\b/i],
  ['deathstep', /\b(deathstep|minatory)\b/i],
  ['melodic-dubstep', /\b(melodic dubstep|chillstep|lovestep)\b/i],
  ['riddim', /\b(riddim|briddim)\b/i],
  ['brostep', /\b(brostep)\b/i],
  ['bass-music', /\b(bass music)\b/i],
  ['dubstep', /\b(dubstep|tearout)\b/i],
  ['moombahcore', /\b(moombahcore|moombah core)\b/i],
  ['kawaii-bass', /\b(kawaii(?: future)? bass|cute future bass)\b/i],
  ['future-bass', /\b(future bass|wave music)\b/i],
  ['hard-trap', /\b(hard trap)\b/i],
  ['hybrid-trap', /\b(hybrid trap)\b/i],
  ['festival-trap', /\b(festival trap|heaven trap|twerk trap)\b/i],
  ['trap-edm', /\b(trap edm|edm trap|electronic trap)\b/i],
  ['midtempo-bass', /\b(midtempo bass|midtempo edm|midtempo)\b/i],
  ['glitch-hop', /\b(glitch hop(?: edm)?|neurohop)\b/i],
  ['moombahton', /\b(moombahton|moombahcore)\b/i],
  ['neurofunk', /\b(neurofunk|neuro drum)\b/i],
  ['liquid-dnb', /\b(liquid (?:drum and bass|drum & bass|dnb|funk)|liquid dnb)\b/i],
  ['dancefloor-dnb', /\b(dancefloor (?:drum and bass|drum & bass|dnb)|dancefloor dnb)\b/i],
  ['jump-up-dnb', /\b(jump[\s-]?up (?:drum and bass|drum & bass|dnb)|jump[\s-]?up dnb)\b/i],
  ['drumstep', /\b(drumstep)\b/i],
  ['jungle', /\b(jungle|ragga jungle)\b/i],
  ['breakcore', /\b(breakcore|lolicore)\b/i],
  ['drum-bass', /\b(drum\s*(?:and|&)\s*bass|drum n bass|dnb)\b/i],
  ['complextro', /\b(complextro)\b/i],
  ['big-room-house', /\b(big room(?: house)?|festival house|festival progressive house)\b/i],
  ['dutch-house', /\b(dutch house|dirty dutch)\b/i],
  ['fidget-house', /\b(fidget house)\b/i],
  ['melbourne-bounce', /\b(melbourne bounce|future bounce)\b/i],
  ['electro-house', /\b(electro house)\b/i],
  ['acid-house', /\b(acid house)\b/i],
  ['tropical-house', /\b(tropical house|trop house)\b/i],
  ['french-house', /\b(french house|filter house|french touch)\b/i],
  ['disco-house', /\b(disco house|funky house)\b/i],
  ['hard-house', /\b(?:uk )?hard house\b/i],
  ['bass-house', /\b(bass house|g house)\b/i],
  ['future-house', /\b(future house|slap house)\b/i],
  ['tech-house', /\b(tech house|minimal deep tech)\b/i],
  ['deep-house', /\b(deep house|lo[\s-]?fi house)\b/i],
  ['progressive-house', /\b(progressive house|mainstage progressive)\b/i],
  ['amapiano', /\b(amapiano)\b/i],
  ['afro-house', /\b(afro house)\b/i],
  ['melodic-house', /\b(melodic house|melodic house & techno|organic house)\b/i],
  ['house', /\b(house music|house)\b/i],
  ['psytrance', /\b(psy[\s-]?trance|goa trance|full[\s-]?on psytrance)\b/i],
  ['uplifting-trance', /\b(uplifting trance|anthem trance)\b/i],
  ['progressive-trance', /\b(progressive trance|trance 2\.0)\b/i],
  ['tech-trance', /\b(tech trance)\b/i],
  ['hard-trance', /\b(hard trance|acid trance)\b/i],
  ['trance', /\b(trance)\b/i],
  ['hard-techno', /\b(hard techno|schranz|hardgroove techno|peak time techno)\b/i],
  ['acid-techno', /\b(acid techno)\b/i],
  ['melodic-techno', /\b(melodic techno)\b/i],
  ['industrial-techno', /\b(industrial techno)\b/i],
  ['minimal-techno', /\b(minimal techno|deep techno|detroit techno)\b/i],
  ['techno', /\b(techno)\b/i],
  ['future-garage', /\b(future garage)\b/i],
  ['speed-garage', /\b(speed garage)\b/i],
  ['two-step-garage', /\b(2[\s-]?step(?: garage)?|two[\s-]?step garage)\b/i],
  ['bassline', /\b(?:uk )?bassline(?: house)?\b/i],
  ['uk-garage', /\b(uk garage|ukg|dark garage)\b/i],
  ['big-beat', /\b(big beat)\b/i],
  ['breakbeat', /\b(breakbeat|breaks|nu skool breaks|progressive breaks)\b/i],
  ['nu-disco', /\b(nu[\s-]?disco|future funk)\b/i],
  ['electro-swing', /\b(electro swing)\b/i],
  ['synthwave', /\b(synthwave|darksynth|retrowave|vaporwave)\b/i],
  ['drift-phonk', /\b(drift[\s-]?phonk|cowbell phonk|street phonk)\b/i],
  ['phonk', /\b(phonk|rare phonk|memphis phonk|cloud phonk)\b/i],
  ['deathcore', /\b(deathcore)\b/i],
  ['metalcore', /\b(metalcore|post[\s-]?hardcore)\b/i],
  ['industrial-metal', /\b(industrial metal|neue deutsche härte)\b/i],
  ['progressive-metal', /\b(progressive metal|djent)\b/i],
  ['death-metal', /\b(death metal|melodic death metal|technical death metal)\b/i],
  ['black-metal', /\b(black metal|blackgaze)\b/i],
  ['nu-metal', /\b(nu[\s-]?metal|rap metal)\b/i],
  ['metal', /(?:\b(?:thrash metal|heavy metal|power metal|doom metal|metal)\b|メタル)/i],
  ['disco-funk', /\b(nu[\s-]?disco|disco|funk)\b/i],
  ['singer-songwriter', /(?:\b(?:singer[\s/-]?songwriter|acoustic pop)\b|シンガー[・\s-]?ソングライター)/i],
  ['country', /(?:\b(?:country(?: pop| rock)?|americana|bluegrass)\b|カントリー)/i],
  ['folk', /\b(indie folk|folk rock|folk|acoustic)\b/i],
  ['jazz', /(?:\b(?:jazz|bebop|swing|bossa nova)\b|ジャズ)/i],
  ['classical', /(?:\b(?:classical|orchestral|opera|chamber music|piano)\b|クラシック)/i],
  ['soundtrack', /(?:\b(?:soundtrack|film score|video game music|original score)\b|サウンドトラック|映画(?:音楽)?\s*[/／・]\s*ゲーム(?:音楽)?|映画音楽|ゲーム音楽)/i],
  ['latin', /(?:\b(?:latin(?: pop| urban| dance| music)?|reggaeton|salsa|bachata|merengue|cumbia|mambo)\b|ラテン|レゲトン|サルサ|バチャータ|メレンゲ|クンビア)/i],
  ['reggae', /(?:\b(?:reggae|dancehall|dub music)\b|レゲエ)/i],
  ['punk', /(?:\b(?:pop punk|punk rock|punk)\b|パンク)/i],
  ['city-pop', /(?:\bcity[\s-]?pop\b|シティ[\s-]?ポップ)/i],
  ['vocaloid', /(?:\bvocaloid\b|ボーカロイド|初音ミク)/i],
  ['anime', /(?:\b(?:anime|anison)\b|アニメ|アニソン)/i],
  ['j-pop', /(?:\b(?:j[\s-]?pop|japanese pop)\b|歌謡曲)/i],
  ['k-pop', /(?:\b(?:k[\s-]?pop|korean pop)\b|케이\s?팝|한국\s?(?:팝|대중음악))/i],
  ['dance-pop', /(?:\b(?:dance[\s-]?pop|electropop|synthpop|europop)\b|ダンス[・\s-]?ポップ)/i],
  ['indie-pop', /(?:\b(?:indie pop|bedroom pop|dream pop)\b|インディー[・\s-]?ポップ)/i],
  ['pop-rock', /(?:\b(?:pop rock|piano rock|power pop)\b|ポップ[・\s-]?ロック)/i],
  ['experimental-hip-hop', /(?:\b(?:experimental[\s-]+(?:hip[\s-]?hop|rap)|abstract[\s-]+hip[\s-]?hop|avant[\s-]?garde[\s-]+hip[\s-]?hop|industrial[\s-]+hip[\s-]?hop)\b|实验说唱|實驗說唱|实验嘻哈|實驗嘻哈|実験的ヒップホップ|エクスペリメンタル[・\s-]?ヒップホップ)/i],
  ['hip-hop', /(?:\b(?:hip[\s-]?hop|rap|trap|grime)\b|ヒップホップ|ラップ)/i],
  ['rnb', /(?:\b(?:r&b|rnb|rhythm and blues|neo soul|soul)\b|ソウル)/i],
  ['pop', /(?:\bpop\b|ポップ)/i],
  ['alternative', /(?:\b(?:alternative rock|indie rock|garage rock|alternative|indie)\b|オルタナティブ)/i],
  ['rock', /(?:\b(?:hard rock|classic rock|punk rock|rock)\b|ロック)/i],
  ['electronic', /(?:\b(?:electronic|electronica|dance|edm|electro)\b|クラブ|ダンス|エレクトロ(?:ニック)?)/i]
];

// These are storefront buckets rather than reliable track-level subgenres.
// Every other recognized tag wins over the curated artist fallback. Artist
// hints stay specific only for specialists with a consistently dominant
// catalog; multi-style artists use their nearest honest common parent.
const ARTIST_FALLBACK_RULE_IDS = new Set(['pop', 'alternative', 'rock', 'electronic']);

const ARTIST_HINTS = new Map(Object.entries({
  'gibi asmr': 'asmr', 'gentle whispering asmr': 'asmr', 'tingting asmr': 'asmr',
  'asmr zeitgeist': 'asmr', 'latte asmr': 'asmr', 'yumemichannel': 'asmr',
  'bad bunny': 'latin', 'j balvin': 'latin', 'daddy yankee': 'latin', 'karol g': 'latin',
  'rauw alejandro': 'latin', 'ozuna': 'latin', 'don omar': 'latin', 'marc anthony': 'latin',
  'romeo santos': 'latin', 'aventura': 'latin', 'celia cruz': 'latin',
  's3rl': 'happy-hardcore', 'nanobii': 'happy-hardcore', 'tatsunoshin': 'happy-hardcore',
  'darren styles': 'uk-hardcore', 'gammer': 'uk-hardcore', 'stonebank': 'uk-hardcore', 'tweekacore': 'uk-hardcore',
  'hixxy': 'uk-hardcore', 'technikore': 'uk-hardcore', 'joey riot': 'uk-hardcore', 'scott brown': 'uk-hardcore',
  't+pazolite': 'hardcore', 'p*light': 'happy-hardcore', 'dj genki': 'happy-hardcore',
  'redalice': 'hardcore', 'camellia': 'hardcore', 'c-show': 'bass-music', 'odium': 'hardcore',
  'angerfist': 'hardcore', 'miss k8': 'gabber', 'mad dog': 'gabber', 'ophidian': 'industrial-hardcore', 'djipe': 'industrial-hardcore',
  'roughsketch': 'hardcore', 'dj myosuke': 'hardcore',
  'dr. peacock': 'frenchcore', 'dr peacock': 'frenchcore', 'sefa': 'frenchcore', 'remzcore': 'frenchcore', 'levenkhan': 'frenchcore',
  'partyraiser': 'uptempo-hardcore', 'lil texas': 'uptempo-hardcore', 'hysta': 'uptempo-hardcore',
  'barber': 'uptempo-hardcore', 'dimitri k': 'uptempo-hardcore', 'unproven': 'uptempo-hardcore',
  'major conspiracy': 'uptempo-hardcore', 'n-vitral': 'uptempo-hardcore', 'deadly guns': 'uptempo-hardcore',
  'f.noize': 'uptempo-hardcore', 'f noize': 'uptempo-hardcore', 'spitnoise': 'uptempo-hardcore',
  'cryogenic': 'uptempo-hardcore', 'trespassed': 'uptempo-hardcore', 'mbk': 'uptempo-hardcore',
  'gpf': 'puzzycore', 'greazy puzzy fuckerz': 'puzzycore',
  'drs': 'uptempo-hardcore', 'unsyn': 'uptempo-hardcore',
  'equal2': 'uptempo-hardcore', 'irradiate': 'uptempo-hardcore',
  'kobaryo': 'hardcore',
  'laur': 'hardcore', 'getty': 'hardcore', 'gram': 'hardcore', 'dustvoxx': 'hardcore',
  'srav3r': 'hardcore', 'dj noriken': 'hardcore', 'aran': 'uk-hardcore',
  'm-project': 'hardcore', 'dj shimamura': 'hardcore', 'noizenecio': 'hardcore', 'm1dy': 'hardcore',
  'minamotoya': 'hardcore', '源屋': 'hardcore', 'kenta-v.ez.': 'hardcore',
  'furyan': 'hardcore', 'andy the core': 'hardcore', 'nora2r': 'hardcore',
  'dither': 'industrial-hardcore', 'igneon system': 'industrial-hardcore', 'soulblast': 'uptempo-hardcore',
  'zekk': 'hard-dance',
  'headhunterz': 'hardstyle', 'brennan heart': 'euphoric-hardstyle', 'da tweekaz': 'euphoric-hardstyle',
  'demi kanon': 'euphoric-hardstyle',
  'd-block & s-te-fan': 'euphoric-hardstyle', 'sub zero project': 'rawstyle', 'rooler': 'rawstyle',
  'sickmode': 'rawstyle', 'radical redemption': 'rawstyle', 'vertile': 'rawstyle',
  'massive new krew': 'hard-dance', 'audiofreq': 'hard-dance', '3r2': 'hard-dance', 'usao': 'frenchcore', 'riran': 'hardstyle',
  'yuta imai': 'rawstyle',
  'wasted penguinz': 'euphoric-hardstyle', 'frontliner': 'euphoric-hardstyle',
  'noisecontrollers': 'euphoric-hardstyle', 'audiotricz': 'euphoric-hardstyle',
  'rebelion': 'rawstyle', 'warface': 'rawstyle', 'd-sturb': 'rawstyle', 'dual damage': 'rawstyle',
  'krowdexx': 'rawstyle', 'fraw': 'rawstyle', 'the purge': 'rawstyle', 'adjuzt': 'rawstyle',
  'mutilator': 'rawstyle', 'aversion': 'rawstyle', 'bloodlust': 'rawstyle', 'anderex': 'rawstyle',
  'riot shift': 'rawstyle', 'thyron': 'rawstyle', 'so juice': 'rawstyle',
  'coone': 'hardstyle', 'wildstylez': 'hardstyle', 'atmozfears': 'hardstyle', 'oryon': 'hardstyle',
  'galactixx': 'hardstyle', 'hard driver': 'hardstyle', 'the elite': 'hardstyle',
  'code black': 'hardstyle', 'adrenalize': 'hardstyle', 'phuture noize': 'hardstyle',
  'showtek': 'hardstyle', 'zatox': 'hardstyle',
  'fisher': 'tech-house', 'chris lake': 'tech-house', 'john summit': 'tech-house', 'dom dolla': 'tech-house',
  'cloonee': 'tech-house', 'pawsa': 'tech-house', 'michael bibi': 'tech-house', 'jamie jones': 'tech-house',
  'claude vonstroke': 'tech-house', 'the martinez brothers': 'tech-house', 'james hype': 'tech-house',
  'dont blink': 'tech-house',
  'lane 8': 'deep-house', 'ben böhmer': 'melodic-house', 'ben bohmer': 'melodic-house',
  'sasha': 'progressive-house', 'john digweed': 'progressive-house', 'hernan cattaneo': 'progressive-house',
  'nick warren': 'progressive-house', 'guy j': 'progressive-house', 'way out west': 'progressive-house',
  'luzon': 'progressive-house',
  'oliver heldens': 'future-house', 'don diablo': 'future-house', 'brooks': 'future-house',
  'mesto': 'future-house', 'mike williams': 'future-house', 'retrovision': 'future-house',
  'deadmau5': 'house', 'martin garrix': 'house', 'daft punk': 'french-house',
  'joyryde': 'bass-house', 'habstrakt': 'bass-house', 'tchami': 'house',
  'malaa': 'bass-house', 'ac slater': 'bass-house', 'wax motif': 'bass-house',
  'dr. fresch': 'bass-house', 'dr fresch': 'bass-house', 'matroda': 'bass-house',
  'knock2': 'bass-house', 'curbi': 'bass-house', 'bijou': 'bass-house',
  'sikdope': 'bass-house', 'cheyenne giles': 'bass-house', 'taiki nulight': 'bass-house',
  'jauz': 'bass-music', 'ghastly': 'bass-music',
  'wolfgang gartner': 'complextro', 'mord fustang': 'complextro', 'feed me': 'complextro',
  'lazy rich': 'complextro', 'far too loud': 'complextro', 'tut tut child': 'complextro',
  'james egbert': 'complextro', 'case & point': 'complextro',
  'tokyo machine': 'electro-house', 'nitro fun': 'electro-house',
  'dyro': 'electro-house', 'bingo players': 'electro-house', 'tommy trash': 'electro-house',
  'overwerk': 'electro-house', 'botnek': 'electro-house',
  'taiga': 'future-house',
  'savant': 'complextro', 'the m machine': 'complextro', 'no mana': 'house', 'eddie': 'complextro',
  'hardwell': 'big-room-house', 'w&w': 'big-room-house', 'blasterjaxx': 'big-room-house',
  'dimitri vegas & like mike': 'big-room-house', 'bassjackers': 'big-room-house', 'ummet ozcan': 'big-room-house',
  'r3hab': 'big-room-house', 'dvbbs': 'big-room-house', 'vinai': 'big-room-house',
  'borgeous': 'big-room-house', 'makj': 'big-room-house', 'dannic': 'big-room-house',
  'firebeatz': 'big-room-house', 'kura': 'big-room-house', 'sick individuals': 'big-room-house',
  'chuckie': 'dutch-house', 'afrojack': 'house', 'sidney samson': 'dutch-house',
  'laidback luke': 'house', 'quintino': 'house',
  'crookers': 'fidget-house', 'the bloody beetroots': 'fidget-house',
  'will sparks': 'melbourne-bounce', 'joel fletcher': 'melbourne-bounce',
  'timmy trumpet': 'melbourne-bounce', 'deorro': 'electro-house',
  'dada life': 'electro-house', 'benny benassi': 'electro-house', 'mstrkrft': 'electro-house',
  'zedd': 'house', 'eric prydz': 'house',
  'swedish house mafia': 'house', 'alesso': 'house',
  'avicii': 'house', 'nicky romero': 'house', 'calvin harris': 'house',
  'x-press 2': 'house', 'gat decor': 'house', 'kshmr': 'big-room-house',
  'phuture': 'acid-house', 'dj pierre': 'acid-house', '808 state': 'acid-house',
  'kygo': 'tropical-house', 'matoma': 'tropical-house', 'thomas jack': 'tropical-house',
  'klingande': 'tropical-house', 'lost frequencies': 'house',
  'cassius': 'french-house', 'étienne de crécy': 'french-house', 'etienne de crecy': 'french-house',
  'alan braxe': 'french-house', 'stardust': 'french-house', 'modjo': 'french-house',
  'purple disco machine': 'disco-house', 'folamour': 'disco-house',
  'boys noize': 'house',
  'lisa lashes': 'hard-house', 'andy farley': 'hard-house',
  'illenium': 'bass-music', 'flume': 'future-bass', 'san holo': 'future-bass',
  'said the sky': 'bass-music', 'dabin': 'bass-music', 'mitis': 'bass-music',
  'marshmello': 'future-bass', 'gryffin': 'future-bass', 'odesza': 'future-bass',
  'louis the child': 'future-bass', 'wave racer': 'future-bass', 'slushii': 'bass-music',
  'droeloe': 'bass-music', 'kasbo': 'future-bass', 'ekali': 'bass-music',
  'alison wonderland': 'bass-music', 'whethan': 'future-bass', 'taska black': 'future-bass',
  'armnhmr': 'bass-music', 'william black': 'bass-music', 'nurko': 'bass-music',
  'jvna': 'bass-music', 'yetep': 'bass-music', 'manila killa': 'future-bass',
  'porter robinson': 'future-bass', 'madeon': 'electro-house', 'grant bowtie': 'future-bass',
  'synthion': 'future-bass', 'pikasonic': 'future-bass', 'aika': 'future-bass',
  'hyper potions': 'future-bass', "snail's house": 'kawaii-bass', 'ujico*': 'kawaii-bass',
  "yuc'e": 'kawaii-bass', 'yunomi': 'kawaii-bass', 'psyqui': 'future-bass',
  'aiobahn': 'kawaii-bass', 'moe shop': 'kawaii-bass', 'honeycomebear': 'kawaii-bass',
  'kotonohouse': 'kawaii-bass', 'dark cat': 'kawaii-bass', 'kirara magic': 'kawaii-bass', 'emocosine': 'kawaii-bass',
  'seven lions': 'bass-music', 'au5': 'bass-music', 'trivecta': 'bass-music',
  'pegboard nerds': 'bass-music', 'going quantum': 'bass-music', 'psychic type': 'bass-music',
  'riot': 'bass-music', 'noisestorm': 'bass-music', 'i see monstas': 'bass-music',
  'monsta': 'bass-music', 'rootkit': 'bass-music', 'tristam': 'bass-music',
  'bossfight': 'bass-music', 'dirtyphonics': 'bass-music',
  'excision': 'dubstep', 'virtual riot': 'dubstep', 'zomboy': 'dubstep', 'barely alive': 'dubstep',
  'must die!': 'dubstep', 'kompany': 'dubstep', 'wooli': 'dubstep', 'ray volpe': 'dubstep',
  'rusko': 'dubstep', 'caspa': 'dubstep', 'space laces': 'bass-music', 'eliminate': 'bass-music',
  'eptic': 'dubstep', 'crankdat': 'bass-music', 'borgore': 'brostep', 'riot ten': 'bass-music',
  'skrillex': 'dubstep', 'flux pavilion': 'dubstep', 'knife party': 'electro-house',
  'doctor p': 'dubstep', 'funtcase': 'dubstep', '12th planet': 'dubstep',
  'spag heddy': 'dubstep', 'badklaat': 'dubstep', 'bear grillz': 'dubstep', 'modestep': 'dubstep',
  'subtronics': 'riddim', 'infekt': 'riddim', 'hol!': 'riddim', 'versa': 'riddim',
  'leotrix': 'dubstep', 'oolacile': 'dubstep',
  'svdden death': 'deathstep', 'marauda': 'deathstep', 'phaseone': 'bass-music', 'sullivan king': 'bass-music',
  'chime': 'colour-bass', 'ace aura': 'colour-bass', 'sharks': 'colour-bass',
  'skybreak': 'colour-bass', 'moore kismet': 'bass-music',
  'g jones': 'bass-music', 'eprom': 'bass-music', 'clozee': 'bass-music',
  'of the trees': 'bass-music', 'lsdream': 'bass-music', 'ivy lab': 'bass-music',
  'shades': 'bass-music', 'peekaboo': 'bass-music',
  'rl grime': 'trap-edm', 'baauer': 'trap-edm', 'uz': 'trap-edm', 'keys n krates': 'trap-edm',
  'what so not': 'bass-music', 'flosstradamus': 'festival-trap',
  'yellow claw': 'festival-trap', 'troyboi': 'trap-edm', 'hucci': 'trap-edm',
  'party favor': 'festival-trap', 'fabian mazur': 'bass-music', 'oski': 'bass-music',
  'nghtmre': 'bass-music', 'boombox cartel': 'bass-music', 'isoxo': 'hybrid-trap',
  'juelz': 'hybrid-trap', 'quix': 'bass-music', 'jawns': 'hybrid-trap', 'apashe': 'bass-music',
  'saymyname': 'hard-trap', 'lit lords': 'hard-trap',
  'rezz': 'midtempo-bass', '1788-l': 'midtempo-bass', 'deathpact': 'midtempo-bass',
  'black tiger sex machine': 'midtempo-bass', 'zabo': 'midtempo-bass',
  'koan sound': 'glitch-hop', 'the glitch mob': 'glitch-hop', 'opiuo': 'glitch-hop', 'haywyre': 'glitch-hop',
  'griz': 'bass-music', 'pretty lights': 'glitch-hop',
  'dillon francis': 'moombahton', 'munchi': 'moombahton', 'dave nada': 'moombahton',
  'noisia': 'neurofunk', 'black sun empire': 'neurofunk', 'pendulum': 'drum-bass',
  'andy c': 'drum-bass', 'chase & status': 'drum-bass',
  'dj fresh': 'drum-bass', 'rudimental': 'drum-bass', 'delta heavy': 'bass-music',
  'droptek': 'drum-bass', 'feint': 'drum-bass', 'muzz': 'drum-bass', 'muzzy': 'drum-bass',
  'koven': 'drum-bass', 'protostar': 'drum-bass', 'rameses b': 'drum-bass',
  'mazare': 'drum-bass', 'reaper': 'drum-bass', 'the qemists': 'drum-bass',
  'zardonic': 'drumstep',
  'maztek': 'neurofunk',
  'netsky': 'drum-bass', 'hybrid minds': 'liquid-dnb', 'high contrast': 'liquid-dnb',
  'calibre': 'liquid-dnb', 'london elektricity': 'liquid-dnb',
  'macky gee': 'jump-up-dnb', 'hedex': 'jump-up-dnb', 'bou': 'jump-up-dnb',
  'kanine': 'jump-up-dnb', 'mozey': 'jump-up-dnb',
  'sub focus': 'dancefloor-dnb', 'dimension': 'dancefloor-dnb', 'culture shock': 'dancefloor-dnb',
  'camo & krooked': 'drum-bass', 'metrik': 'dancefloor-dnb',
  'wilkinson': 'dancefloor-dnb', 'shy fx': 'drum-bass', 'congo natty': 'jungle', 'nia archives': 'jungle',
  'fox stevenson': 'drum-bass',
  'charlotte de witte': 'techno', 'amelie lens': 'techno', 'i hate models': 'techno', 'umek': 'techno',
  'adam beyer': 'techno', 'carl cox': 'techno', 'nina kraviz': 'techno',
  'jeff mills': 'techno', 'derrick may': 'techno', 'kevin saunderson': 'techno',
  'ben klock': 'techno', 'dax j': 'techno', 'enrico sangiuliano': 'techno',
  'boris brejcha': 'minimal-techno',
  'sara landry': 'hard-techno', 'nico moreno': 'hard-techno', '999999999': 'hard-techno',
  'klangkuenstler': 'hard-techno', 'regal': 'techno',
  'tale of us': 'melodic-techno', 'anyma': 'melodic-techno', 'artbat': 'melodic-techno',
  'paula temple': 'industrial-techno', 'perc': 'industrial-techno',
  'richie hawtin': 'minimal-techno', 'robert hood': 'minimal-techno',
  'armin van buuren': 'trance', 'above & beyond': 'trance', 'vini vici': 'psytrance', 'lapix': 'psytrance',
  'tiesto': 'trance', 'tiësto': 'trance', 'bt': 'trance', 'darude': 'trance',
  'energy 52': 'trance', 'jam & spoon': 'trance', 'atb': 'trance', 'age of love': 'trance',
  'chicane': 'trance', 'rank 1': 'trance', 'push': 'trance', 'solarstone': 'trance',
  'penta': 'psytrance',
  'paul van dyk': 'trance', 'ferry corsten': 'trance', 'cosmic gate': 'trance',
  'paul oakenfold': 'trance', 'factor b': 'uplifting-trance', 'will atkinson': 'trance',
  'infected mushroom': 'psytrance', 'astrix': 'psytrance',
  'aly & fila': 'uplifting-trance', 'giuseppe ottaviani': 'uplifting-trance',
  'bryan kearney': 'trance', 'john ocallaghan': 'trance',
  'gabriel & dresden': 'progressive-trance', 'markus schulz': 'progressive-trance',
  'andrew bayer': 'progressive-trance', 'grum': 'progressive-trance',
  'scot project': 'hard-trance', 'yoji biomehanika': 'hard-trance',
  'burial': 'future-garage', 'pinkpantheress': 'pop', 'overmono': 'breakbeat',
  'dj q': 'speed-garage', 'interplanetary criminal': 'speed-garage',
  'double 99': 'speed-garage', '187 lockdown': 'speed-garage',
  'artful dodger': 'two-step-garage', 'dem 2': 'two-step-garage',
  'el-b': 'two-step-garage', 'horsepower productions': 'two-step-garage',
  'mj cole': 'uk-garage', 'conducta': 'uk-garage', 'sammy virji': 'uk-garage',
  'shanks & bigfoot': 'uk-garage', 'wookie': 'uk-garage', 'zed bias': 'uk-garage',
  'todd edwards': 'uk-garage', 'sunship': 'uk-garage', 'silva bumpa': 'uk-garage',
  'disclosure': 'house', 'salute': 'house', 'oppidan': 'uk-garage',
  'holy goof': 'bassline', 'skepsis': 'bassline', 'ts7': 'bassline', 'notion': 'bassline',
  'the chemical brothers': 'big-beat', 'fatboy slim': 'big-beat', 'the prodigy': 'big-beat',
  'the crystal method': 'big-beat', 'propellerheads': 'big-beat',
  'stanton warriors': 'breakbeat', 'plump djs': 'breakbeat', 'freestylers': 'breakbeat', 'bicep': 'breakbeat',
  'chromeo': 'nu-disco', 'roosevelt': 'nu-disco', 'breakbot': 'nu-disco',
  "l'impératrice": 'nu-disco', 'parcels': 'nu-disco',
  'caravan palace': 'electro-swing', 'parov stelar': 'electro-swing', 'swingrowers': 'electro-swing',
  'tape five': 'electro-swing', 'jamie berry': 'electro-swing', 'aronchupa': 'electro-swing',
  'carpenter brut': 'synthwave', 'perturbator': 'synthwave',
  'lady gaga': 'dance-pop', 'dua lipa': 'dance-pop', 'charli xcx': 'dance-pop', 'little sis nora': 'dance-pop',
  'madonna': 'dance-pop', 'katy perry': 'dance-pop', 'britney spears': 'dance-pop',
  'taylor swift': 'pop', 'ariana grande': 'pop', 'bruno mars': 'pop', 'whitney houston': 'pop', 'cg5': 'pop',
  'michael jackson': 'pop', 'miley cyrus': 'pop', 'selena gomez': 'pop', 'justin bieber': 'pop',
  'justin timberlake': 'pop', 'christina aguilera': 'pop', 'lorde': 'indie-pop', 'lana del rey': 'indie-pop',
  '4s4ki': 'alternative',
  'chappell roan': 'pop', 'sabrina carpenter': 'pop', 'adam lambert': 'pop',
  'ajr': 'pop', 'imagine dragons': 'pop-rock', 'onerepublic': 'pop-rock',
  'coldplay': 'pop-rock', 'paramore': 'pop-rock', 'olivia rodrigo': 'pop-rock',
  'billie eilish': 'indie-pop', 'twenty one pilots': 'alternative',
  'fall out boy': 'pop-rock', 'panic! at the disco': 'pop-rock', 'my chemical romance': 'pop-rock',
  'green day': 'punk', 'radiohead': 'alternative', 'muse': 'alternative', 'nirvana': 'alternative',
  'the pinballs': 'rock', 'escape plan': 'rock',
  'foo fighters': 'rock', 'the killers': 'alternative',
  'the weeknd': 'rnb', 'sza': 'rnb', 'frank ocean': 'rnb', 'beyoncé': 'rnb',
  'rihanna': 'pop', 'adele': 'pop', 'harry styles': 'pop', 'ed sheeran': 'pop',
  'hozier': 'folk', 'arctic monkeys': 'alternative', 'tame impala': 'alternative',
  'queen': 'rock', 'måneskin': 'rock',
  'red hot chili peppers': 'rock', 'ac/dc': 'rock', 'led zeppelin': 'rock',
  'the rolling stones': 'rock', "guns n' roses": 'rock', 'david bowie': 'rock',
  'the beatles': 'pop-rock', 'oasis': 'pop-rock', 'pearl jam': 'alternative',
  'the smashing pumpkins': 'alternative',
  'kendrick lamar': 'hip-hop', 'travis scott': 'hip-hop', 'tyler, the creator': 'hip-hop', 'cupcakke': 'hip-hop',
  'eminem': 'hip-hop', 'drake': 'hip-hop', 'kanye west': 'hip-hop', 'j. cole': 'hip-hop',
  'nas': 'hip-hop', 'jay-z': 'hip-hop',
  'mc赵小六': 'experimental-hip-hop', 'mc 赵小六': 'experimental-hip-hop',
  'spaceghostpurrp': 'phonk', 'dj smokey': 'phonk', 'soudiere': 'phonk', 'freddie dredd': 'phonk',
  'kordhell': 'drift-phonk', 'dvrst': 'drift-phonk', 'interworld': 'drift-phonk',
  'moondeity': 'drift-phonk', 'ghostface playa': 'drift-phonk', 'pharmacist': 'drift-phonk',
  'shadxwbxrn': 'drift-phonk', 'playaphonk': 'drift-phonk', 'lxst cxntury': 'drift-phonk',
  'yoasobi': 'j-pop', 'ado': 'j-pop', 'kenshi yonezu': 'j-pop', '米津玄師': 'j-pop',
  'supercell': 'j-pop', 'mafumafu': 'j-pop', 'bpm15q': 'j-pop', 'needy girl overdose': 'j-pop',
  'rionos': 'anime', 'fripside': 'anime', 'nana mizuki': 'anime', 'liella!': 'anime',
  'livetune': 'vocaloid', 'nicamoq': 'kawaii-bass',
  'yorushika': 'j-pop', 'ヨルシカ': 'j-pop', 'zutomayo': 'j-pop', 'ずっと真夜中でいいのに。': 'j-pop',
  'reol': 'j-pop', 'aimer': 'j-pop',
  'official hige dandism': 'j-pop', 'official髭男dism': 'j-pop', 'mrs. green apple': 'j-pop',
  'fujii kaze': 'j-pop', '藤井風': 'j-pop', 'vaundy': 'j-pop', 'king gnu': 'alternative',
  'atarashii gakko!': 'j-pop', '新しい学校のリーダーズ': 'j-pop',
  'perfume': 'dance-pop', 'sakanaction': 'alternative', 'サカナクション': 'alternative',
  'lisa': 'j-pop', 'eve': 'j-pop', 'milet': 'j-pop', 'minami': 'j-pop', '美波': 'j-pop',
  'honeyworks': 'j-pop', 'nanawoakari': 'j-pop', 'yurika': 'j-pop', 'neko hacker': 'j-pop',
  'ryo (supercell) × やなぎなぎ': 'j-pop',
  'hikaru utada': 'j-pop', 'utada hikaru': 'j-pop', '宇多田ヒカル': 'j-pop',
  'egoist': 'j-pop', 'claris': 'j-pop', 'bump of chicken': 'j-pop',
  'asian kung-fu generation': 'rock', 'kyary pamyu pamyu': 'j-pop', 'きゃりーぱみゅぱみゅ': 'j-pop',
  'aimyon': 'j-pop', 'あいみょん': 'j-pop', 'ryokuoushoku shakai': 'pop-rock', '緑黄色社会': 'pop-rock',
  'radwimps': 'pop-rock', 'one ok rock': 'rock', 'band-maid': 'rock',
  'back number': 'j-pop', 'gen hoshino': 'j-pop', '星野源': 'j-pop',
  'ikimonogakari': 'j-pop', 'いきものがかり': 'j-pop', 'sekai no owari': 'j-pop',
  'super beaver': 'pop-rock', 'マカロニえんぴつ': 'pop-rock',
  'bts': 'k-pop', '방탄소년단': 'k-pop', 'blackpink': 'k-pop', '블랙핑크': 'k-pop',
  'twice': 'k-pop', '트와이스': 'k-pop', 'newjeans': 'k-pop', '뉴진스': 'k-pop',
  'aespa': 'k-pop', '에스파': 'k-pop', 'stray kids': 'k-pop', '스트레이 키즈': 'k-pop',
  'seventeen': 'k-pop', '세븐틴': 'k-pop', 'red velvet': 'k-pop', '레드벨벳': 'k-pop',
  'ive': 'k-pop', '아이브': 'k-pop', 'le sserafim': 'k-pop', '르세라핌': 'k-pop',
  '(g)i-dle': 'k-pop', '여자아이들': 'k-pop', 'itzy': 'k-pop', '있지': 'k-pop',
  'nct 127': 'k-pop', 'nct dream': 'k-pop', 'enhypen': 'k-pop', '엔하이픈': 'k-pop',
  'tomorrow x together': 'k-pop', '투모로우바이투게더': 'k-pop', 'shinee': 'k-pop', '샤이니': 'k-pop',
  'babymetal': 'metal', 'x japan': 'metal', 'creepy nuts': 'hip-hop', 'chanmina': 'hip-hop',
  'nujabes': 'hip-hop', 'mariya takeuchi': 'city-pop', '竹内まりや': 'city-pop',
  'tatsuro yamashita': 'city-pop', '山下達郎': 'city-pop',
  'hatsune miku': 'vocaloid', '初音ミク': 'vocaloid', 'deco*27': 'vocaloid',
  'pinocchiop': 'vocaloid', 'ピノキオピー': 'vocaloid', 'wowaka': 'vocaloid', 'neru': 'vocaloid',
  'spiritbox': 'metalcore', 'architects': 'metalcore', 'bring me the horizon': 'metal',
  'killswitch engage': 'metalcore', 'parkway drive': 'metalcore', 'electric callboy': 'metalcore',
  'lorna shore': 'deathcore', 'slaughter to prevail': 'deathcore',
  'meshuggah': 'progressive-metal', 'periphery': 'progressive-metal', 'tool': 'progressive-metal',
  'dream theater': 'progressive-metal', 'opeth': 'progressive-metal',
  'rammstein': 'industrial-metal', 'mick gordon': 'industrial-metal', 'nine inch nails': 'industrial-metal', 'marilyn manson': 'rock',
  'polyphia': 'progressive-metal',
  'slipknot': 'nu-metal', 'korn': 'nu-metal', 'linkin park': 'rock',
  'system of a down': 'metal', 'deftones': 'metal',
  'lamb of god': 'metal', 'mastodon': 'metal', 'disturbed': 'metal',
  'metallica': 'metal', 'iron maiden': 'metal', 'gojira': 'metal',
  'black sabbath': 'metal', 'judas priest': 'metal', 'slayer': 'metal', 'megadeth': 'metal',
  'pantera': 'metal', 'avenged sevenfold': 'metal',
  'hans zimmer': 'soundtrack', 'john williams': 'soundtrack', 'joe hisaishi': 'soundtrack', 'jaroslav beck': 'soundtrack',
  '久石譲': 'soundtrack', 'miles davis': 'jazz', 'john coltrane': 'jazz',
  'herbie hancock': 'jazz', 'tony bennett': 'jazz', 'jon batiste': 'jazz',
  'sarah brightman': 'classical', 'andrea bocelli': 'classical', 'bob marley': 'reggae',

  // Fill the formerly thin genre branches with established specialists.
  // Broad or stylistically mobile artists deliberately stay on their nearest
  // honest parent instead of receiving a misleading track-level subgenre.
  'kerri chandler': 'deep-house', 'larry heard': 'deep-house', 'maya jane coles': 'deep-house',
  'monolink': 'melodic-house', 'jan blomqvist': 'melodic-house', 'rodriguez jr.': 'melodic-house',
  'black coffee': 'afro-house', 'shimza': 'afro-house', 'da capo': 'afro-house',
  'culoe de song': 'afro-house', 'caiiro': 'afro-house', 'amémé': 'afro-house', 'ameme': 'afro-house',
  'kabza de small': 'amapiano', 'dj maphorisa': 'amapiano', 'uncle waffles': 'amapiano',
  'kelvin momo': 'amapiano', 'dbn gogo': 'amapiano', 'major league djz': 'amapiano',
  'a guy called gerald': 'acid-house', 'adonis': 'acid-house', 'sleezy d': 'acid-house',
  'switch': 'fidget-house', 'fake blood': 'fidget-house', 'hervé': 'fidget-house', 'herve': 'fidget-house',
  'gregor salto': 'dutch-house', 'ralvero': 'dutch-house',
  'duck sauce': 'disco-house', 'the shapeshifters': 'disco-house', 'armand van helden': 'disco-house',
  'bk': 'hard-house', 'tidy boys': 'hard-house', 'paul glazby': 'hard-house',
  'uberjakd': 'melbourne-bounce', 'scndl': 'melbourne-bounce', 'tjr': 'melbourne-bounce',

  'getter': 'brostep', 'dodge & fuski': 'brostep', 'cookie monsta': 'brostep',
  'last heroes': 'melodic-dubstep', 'crystal skies': 'melodic-dubstep', 'abandoned': 'melodic-dubstep',
  'papa khan': 'future-riddim', 'beastboi.': 'future-riddim', 'voltra': 'future-riddim',
  'code: pandorum': 'deathstep', 'qoiet': 'deathstep', 'tengraphs': 'deathstep',
  'alvin risk': 'moombahcore', 'nick thayer': 'moombahcore',
  'gravedgr': 'hard-trap', 'bailo': 'hard-trap',

  'kj sawka': 'drumstep', 'figure': 'drumstep',
  'shy fx': 'jungle', 'general levy': 'jungle', 'dillinja': 'jungle',
  'synkro': 'future-garage', 'vacant': 'future-garage', 'sorrow': 'future-garage', 'phaeleh': 'future-garage',
  'venetian snares': 'breakcore', 'goreshit': 'breakcore', 'machine girl': 'breakcore', 'sewerslvt': 'breakcore',

  '999999999': 'acid-techno', 'chris liberator': 'acid-techno', 'd.a.v.e. the drummer': 'acid-techno',
  'ancient methods': 'industrial-techno', 'snts': 'industrial-techno', 'ansome': 'industrial-techno',
  'bryan kearney': 'tech-trance', 'john ocallaghan': 'tech-trance', 'simon patterson': 'tech-trance', 'mark sherry': 'tech-trance',
  'renegade system': 'hard-trance', 'lab4': 'hard-trance',
  'kavinsky': 'synthwave', 'the midnight': 'synthwave', 'fm-84': 'synthwave', 'gunship': 'synthwave', 'timecop1983': 'synthwave',

  'the clash': 'punk', 'ramones': 'punk', 'sex pistols': 'punk', 'rancid': 'punk',
  'bad religion': 'punk', 'the offspring': 'punk',
  'bob dylan': 'folk', 'joan baez': 'folk', 'joni mitchell': 'folk', 'bon iver': 'folk',
  'mumford & sons': 'folk', 'fleet foxes': 'folk',
  'peter tosh': 'reggae', 'jimmy cliff': 'reggae', 'burning spear': 'reggae',
  'toots and the maytals': 'reggae', 'gregory isaacs': 'reggae',
  'neophyte': 'gabber', 'rotterdam terror corps': 'gabber', 'the stunned guys': 'gabber',

  'chic': 'disco-funk', 'earth, wind & fire': 'disco-funk', 'kool & the gang': 'disco-funk',
  'parliament': 'disco-funk', 'jamiroquai': 'disco-funk',
  'james taylor': 'singer-songwriter', 'carole king': 'singer-songwriter',
  'leonard cohen': 'singer-songwriter', 'damien rice': 'singer-songwriter',
  'johnny cash': 'country', 'dolly parton': 'country', 'willie nelson': 'country',
  'chris stapleton': 'country', 'luke combs': 'country', 'kacey musgraves': 'country',
  'cannibal corpse': 'death-metal', 'death': 'death-metal', 'morbid angel': 'death-metal',
  'obituary': 'death-metal', 'deicide': 'death-metal',
  'mayhem': 'black-metal', 'darkthrone': 'black-metal', 'emperor': 'black-metal',
  'immortal': 'black-metal', 'burzum': 'black-metal',
  'whitechapel': 'deathcore', 'chelsea grin': 'deathcore',
  'limp bizkit': 'nu-metal', 'papa roach': 'nu-metal',
  'ludovico einaudi': 'classical', 'lang lang': 'classical', 'yuja wang': 'classical'
}).map(([artist, id]) => [normalize(artist), id]));

// Apple Music localizes a number of Western artist names on the Japanese
// storefront. Keep display metadata untouched, but classify and compare these
// spellings through one canonical identity.
const ARTIST_ALIASES = new Map(Object.entries({
  'ゾムボーイ': 'zomboy',
  'マリリン・マンソン': 'marilyn manson',
  'ナイン・インチ・ネイルズ': 'nine inch nails',
  'レディー・ガガ': 'lady gaga',
  'スクリレックス': 'skrillex',
  'エクシジョン': 'excision',
  'バーチャル・ライオット': 'virtual riot',
  'ヴァーチャル・ライオット': 'virtual riot',
  'イレニアム': 'illenium',
  'セヴン・ライオンズ': 'seven lions',
  'ポーター・ロビンソン': 'porter robinson',
  'マデオン': 'madeon',
  'ダフト・パンク': 'daft punk',
  'デッドマウス': 'deadmau5',
  'アフロジャック': 'afrojack',
  'ウルフギャング・ガルトナー': 'wolfgang gartner',
  'ヴォルフガング・ガートナー': 'wolfgang gartner',
  'モード・ファスタング': 'mord fustang',
  'フィード・ミー': 'feed me',
  'ナイフ・パーティー': 'knife party',
  'ベニー・ベナッシ': 'benny benassi',
  'ダダ・ライフ': 'dada life',
  'フラックス・パビリオン': 'flux pavilion',
  'フラックス・バヴィリオン': 'flux pavilion',
  'RL・グライム': 'rl grime',
  'RL グライム': 'rl grime',
  'サブ・フォーカス': 'sub focus',
  'チェイス・アンド・ステイタス': 'chase & status',
  'パープル・ディスコ・マシーン': 'purple disco machine',
  'ハードウェル': 'hardwell',
  'カイゴ': 'kygo',
  'フルーム': 'flume',
  'ディロン・フランシス': 'dillon francis',
  'ザ・ケミカル・ブラザーズ': 'the chemical brothers',
  'ケミカル・ブラザーズ': 'the chemical brothers',
  'ザ・プロディジー': 'the prodigy',
  'リンキン・パーク': 'linkin park',
  'スリップノット': 'slipknot',
  'ラムシュタイン': 'rammstein',
  'メタリカ': 'metallica',
  'レッド・ホット・チリ・ペッパーズ': 'red hot chili peppers',
  'イマジン・ドラゴンズ': 'imagine dragons',
  'トゥエンティ・ワン・パイロッツ': 'twenty one pilots',
  'ザ・ウィークエンド': 'the weeknd',
  'ビリー・アイリッシュ': 'billie eilish',
  'デュア・リパ': 'dua lipa',
  'テイラー・スウィフト': 'taylor swift',
  'アリアナ・グランデ': 'ariana grande',
  'アダム・ランバート': 'adam lambert',
  'エミネム': 'eminem',
  'クイーン': 'queen',
  'トニー・ベネット': 'tony bennett',
  'アヴィーチー': 'avicii',
  'ティエスト': 'tiesto',
  'デオロ': 'deorro',
  'サシャ': 'sasha',
  'カルヴィン・ハリス': 'calvin harris',
  'ウィリアム・オービット': 'william orbit',
  'ジャム&スプーン': 'jam & spoon',
  'ガブリエル&ドレスデン': 'gabriel & dresden',
  'アートフル・ドジャー': 'artful dodger',
  'MJコール': 'mj cole',
  'チェイス&ステイタス': 'chase & status',
  'ボットネック': 'botnek',
  'スコット・ブラウン': 'scott brown',
  'ホイットニー・ヒューストン': 'whitney houston',
  'ジョン・バティステ': 'jon batiste',
  'サラ・ブライトマン': 'sarah brightman',
  'アンドレア・ボチェッリ': 'andrea bocelli',
  'ナナヲアカリ': 'nanawoakari',
  'かめりあ': 'camellia',
  'ポリフィア': 'polyphia',
  'エモコサイン': 'emocosine',
  'バッド・バニー': 'bad bunny',
  'J・バルヴィン': 'j balvin',
  'J.バルヴィン': 'j balvin',
  'ダディー・ヤンキー': 'daddy yankee',
  'カロルG': 'karol g',
  'カロル・G': 'karol g',
  'ラウ・アレハンドロ': 'rauw alejandro',
  'オズナ': 'ozuna',
  'ドン・オマール': 'don omar',
  'マーク・アンソニー': 'marc anthony',
  'ロメオ・サントス': 'romeo santos',
  'アヴェントゥーラ': 'aventura',
  'セリア・クルス': 'celia cruz',
  'ボブ・マーリー': 'bob marley',
  'グリーン・デイ': 'green day',
  'ザ・クラッシュ': 'the clash',
  'セックス・ピストルズ': 'sex pistols',
  'ラモーンズ': 'ramones',
  'オフスプリング': 'the offspring',
  'ボブ・ディラン': 'bob dylan',
  'ジョニ・ミッチェル': 'joni mitchell',
  'ボン・イヴェール': 'bon iver',
  'マムフォード&サンズ': 'mumford & sons',
  'カヴィンスキー': 'kavinsky',
  'ザ・ミッドナイト': 'the midnight',
  'ブラック・コーヒー': 'black coffee',
  'シック': 'chic',
  'アース・ウインド&ファイアー': 'earth, wind & fire',
  'ジャミロクワイ': 'jamiroquai',
  'ジョニー・キャッシュ': 'johnny cash',
  'ドリー・パートン': 'dolly parton',
  'ウィリー・ネルソン': 'willie nelson',
  'カニバル・コープス': 'cannibal corpse',
  'メイヘム': 'mayhem',
  'ダークスローン': 'darkthrone',
  '逃跑计划': 'escape plan'
}).map(([alias, canonical]) => [normalize(alias), normalize(canonical)]));

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function canonicalArtist(value) {
  const clean = normalize(value);
  return ARTIST_ALIASES.get(clean) || clean;
}

// Display names for artists whose original names use Latin characters but are
// localized into katakana by the Japanese Apple Music storefront.  Keep this
// separate from ARTIST_ALIASES: that lookup also contains genuinely Japanese
// artists whose native display names should not be replaced.
const WESTERN_ARTIST_DISPLAY_NAMES = new Map(Object.entries({
  zomboy: 'Zomboy',
  'marilyn manson': 'Marilyn Manson',
  'nine inch nails': 'Nine Inch Nails',
  'lady gaga': 'Lady Gaga',
  skrillex: 'Skrillex',
  excision: 'Excision',
  'virtual riot': 'Virtual Riot',
  illenium: 'ILLENIUM',
  'seven lions': 'Seven Lions',
  'porter robinson': 'Porter Robinson',
  madeon: 'Madeon',
  'daft punk': 'Daft Punk',
  deadmau5: 'deadmau5',
  afrojack: 'Afrojack',
  'wolfgang gartner': 'Wolfgang Gartner',
  'mord fustang': 'Mord Fustang',
  'feed me': 'Feed Me',
  'knife party': 'Knife Party',
  'benny benassi': 'Benny Benassi',
  'dada life': 'Dada Life',
  'flux pavilion': 'Flux Pavilion',
  'rl grime': 'RL Grime',
  'sub focus': 'Sub Focus',
  'chase & status': 'Chase & Status',
  'purple disco machine': 'Purple Disco Machine',
  hardwell: 'Hardwell',
  kygo: 'Kygo',
  flume: 'Flume',
  'dillon francis': 'Dillon Francis',
  'the chemical brothers': 'The Chemical Brothers',
  'the prodigy': 'The Prodigy',
  'linkin park': 'Linkin Park',
  slipknot: 'Slipknot',
  rammstein: 'Rammstein',
  metallica: 'Metallica',
  'red hot chili peppers': 'Red Hot Chili Peppers',
  'imagine dragons': 'Imagine Dragons',
  'twenty one pilots': 'Twenty One Pilots',
  'the weeknd': 'The Weeknd',
  'billie eilish': 'Billie Eilish',
  'dua lipa': 'Dua Lipa',
  'taylor swift': 'Taylor Swift',
  'ariana grande': 'Ariana Grande',
  'adam lambert': 'Adam Lambert',
  eminem: 'Eminem',
  queen: 'Queen',
  'tony bennett': 'Tony Bennett',
  avicii: 'Avicii',
  tiesto: 'Tiësto',
  deorro: 'Deorro',
  sasha: 'Sasha',
  'calvin harris': 'Calvin Harris',
  'william orbit': 'William Orbit',
  'jam & spoon': 'Jam & Spoon',
  'gabriel & dresden': 'Gabriel & Dresden',
  'artful dodger': 'Artful Dodger',
  'mj cole': 'MJ Cole',
  botnek: 'Botnek',
  'scott brown': 'Scott Brown',
  'whitney houston': 'Whitney Houston',
  'jon batiste': 'Jon Batiste',
  'sarah brightman': 'Sarah Brightman',
  'andrea bocelli': 'Andrea Bocelli',
  polyphia: 'Polyphia',
  'bad bunny': 'Bad Bunny',
  'j balvin': 'J Balvin',
  'daddy yankee': 'Daddy Yankee',
  'karol g': 'KAROL G',
  'rauw alejandro': 'Rauw Alejandro',
  ozuna: 'Ozuna',
  'don omar': 'Don Omar',
  'marc anthony': 'Marc Anthony',
  'romeo santos': 'Romeo Santos',
  aventura: 'Aventura',
  'celia cruz': 'Celia Cruz',
  'bob marley': 'Bob Marley',
  'green day': 'Green Day',
  'the clash': 'The Clash',
  'sex pistols': 'Sex Pistols',
  ramones: 'Ramones',
  'the offspring': 'The Offspring',
  'bob dylan': 'Bob Dylan',
  'joni mitchell': 'Joni Mitchell',
  'bon iver': 'Bon Iver',
  'mumford & sons': 'Mumford & Sons',
  kavinsky: 'Kavinsky',
  'the midnight': 'The Midnight',
  'black coffee': 'Black Coffee',
  chic: 'Chic',
  'earth, wind & fire': 'Earth, Wind & Fire',
  jamiroquai: 'Jamiroquai',
  'johnny cash': 'Johnny Cash',
  'dolly parton': 'Dolly Parton',
  'willie nelson': 'Willie Nelson',
  'cannibal corpse': 'Cannibal Corpse',
  mayhem: 'Mayhem',
  darkthrone: 'Darkthrone'
}).map(([canonical, display]) => [normalize(canonical), display]));

function displayArtistName(value) {
  const source = String(value || '').normalize('NFKC').trim();
  if (!source) return '';

  const displayPart = (part) => {
    const canonical = ARTIST_ALIASES.get(normalize(part));
    return WESTERN_ARTIST_DISPLAY_NAMES.get(canonical) || part;
  };

  // Fast path for a single artist, including names such as Jam & Spoon whose
  // ampersand is part of the stage name rather than an artist separator.
  const exact = displayPart(source);
  if (exact !== source) return exact;

  // Apple commonly joins multiple localized artists with Japanese commas or
  // spaced Latin connectors. Preserve the connector exactly while converting
  // each recognized Western name independently.
  return source
    .split(/(\s+(?:feat\.?|ft\.?|vs\.?)\s+|\s+&\s+|\s*、\s*|\s*,\s*|\s+\/\s+|\s+[x×]\s+)/i)
    .map((part, index) => index % 2 ? part : displayPart(part.trim()))
    .join('');
}

function artistHint(cleanArtist) {
  const canonical = canonicalArtist(cleanArtist);
  if (ARTIST_HINTS.has(canonical)) return { key: canonical, id: ARTIST_HINTS.get(canonical) };
  const parts = cleanArtist.split(/\s+(?:feat\.?|ft\.?|vs\.?)\s+|\s*[,&/]\s+|\s+x\s+/i)
    .map(canonicalArtist)
    .filter(Boolean);
  for (const part of parts) {
    if (ARTIST_HINTS.has(part)) return { key: part, id: ARTIST_HINTS.get(part) };
  }
  for (const [key, id] of ARTIST_HINTS) {
    if (key.length >= 5 && new RegExp(`(?:^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i').test(canonical)) {
      return { key, id };
    }
  }
  return null;
}

function ruleMatch(value) {
  const text = String(value || '');
  for (const [id, pattern] of RULES) {
    const match = text.match(pattern);
    if (match) return { id, matched: match[0] };
  }
  return null;
}

function classifyGenre({ tags = [], artist = '', title = '' } = {}) {
  // ASMR is a content mode rather than a conventional music genre. Explicit
  // title/artist signals therefore override storefront genre metadata.
  const asmrSignal = `${artist}\n${title}`.match(ASMR_SIGNAL_PATTERN);
  if (asmrSignal) {
    return {
      id: 'asmr',
      ...themeFor('asmr'),
      matched: `metadata:${asmrSignal[0]}`,
      confidence: 0.98
    };
  }
  // Bangarang is deliberately treated as a track-level case. Skrillex's
  // catalog spans several bass styles, so this must not become an artist hint.
  const normalizedTitle = normalize(title);
  const trackArtists = normalize(artist)
    .split(/\s+(?:feat\.?|ft\.?|vs\.?)\s+|\s*[,&/]\s+|\s+x\s+/i)
    .map(canonicalArtist)
    .filter(Boolean);
  const bangarang = /\bbangarang\b/i.test(normalizedTitle)
    && trackArtists.some((value) => value === 'skrillex'
      || /(?:^|[^a-z0-9])skrillex(?:$|[^a-z0-9])/i.test(value));
  if (bangarang) {
    return {
      id: 'moombahcore',
      ...themeFor('moombahcore'),
      note: '(NOT DUBSTEP)',
      matched: 'track:skrillex/bangarang',
      confidence: 0.99
    };
  }
  const cleanArtist = normalize(artist).replace(/\s+(?:feat\.?|ft\.?).*$/, '').trim();
  const hintMatch = artistHint(cleanArtist);
  const rankedTagResults = tags
    .filter(Boolean)
    .map(canonicalizeGenreLabel)
    .map(ruleMatch)
    .filter(Boolean);
  // Catalog and community services return tags in relevance order. Preserve
  // that ranking instead of joining every tag and letting RULES order promote
  // a zero-vote tail tag over the artist's dominant style. Only storefront
  // umbrella buckets are skipped while looking for a useful concrete tag.
  let tagResult = rankedTagResults[0] || null;
  for (const candidate of rankedTagResults.slice(1)) {
    if (!tagResult || ['electronic', 'pop'].includes(tagResult.id)) {
      tagResult = candidate;
      continue;
    }
    const currentTheme = themeFor(tagResult.id);
    const candidateTheme = themeFor(candidate.id);
    const refinesCurrent = candidateTheme.family === currentTheme.family
      || candidateTheme.parent === currentTheme.label;
    if (refinesCurrent && candidate.id !== tagResult.id) tagResult = candidate;
  }
  const titleResult = ruleMatch(title);
  const artistRefinesBroadHardcore = Boolean(
    hintMatch
    && tagResult
    && ['hard-dance', 'hardcore', 'uptempo-hardcore'].includes(tagResult.id)
    && themeFor(hintMatch.id).mode === 'hardcore'
    && hintMatch.id !== tagResult.id
  );
  const artistRefinesBroadPhonk = Boolean(
    hintMatch
    && tagResult
    && ['hip-hop', 'phonk'].includes(tagResult.id)
    && themeFor(hintMatch.id).mode === 'phonk'
    && hintMatch.id !== tagResult.id
  );
  const artistRefinesBroadHipHop = Boolean(
    hintMatch
    && tagResult
    && tagResult.id === 'hip-hop'
    && hintMatch.id === 'experimental-hip-hop'
  );

  // A concrete queried/embedded tag wins. Artist mappings only refine empty
  // results or very broad storefront buckets such as Electronic/Pop/Rock.
  let selected;
  let confidence;
  if (tagResult
    && !ARTIST_FALLBACK_RULE_IDS.has(tagResult.id)
    && !artistRefinesBroadHardcore
    && !artistRefinesBroadPhonk
    && !artistRefinesBroadHipHop) {
    selected = tagResult;
    confidence = 0.9;
  } else if (hintMatch && titleResult && titleResult.id !== hintMatch.id) {
    const hintTheme = themeFor(hintMatch.id);
    const titleTheme = themeFor(titleResult.id);
    const titleRefinesArtist = titleTheme.family === hintTheme.family
      || titleTheme.parent === hintTheme.label;
    if (titleRefinesArtist) {
      selected = { ...titleResult, matched: `title:${titleResult.matched}` };
      confidence = 0.8;
    } else {
      selected = { id: hintMatch.id, matched: `artist:${hintMatch.key}` };
      confidence = 0.78;
    }
  } else if (hintMatch) {
    selected = { id: hintMatch.id, matched: `artist:${hintMatch.key}` };
    confidence = 0.78;
  } else if (titleResult && titleResult.id !== 'electronic') {
    selected = { ...titleResult, matched: `title:${titleResult.matched}` };
    confidence = 0.72;
  } else if (tagResult) {
    selected = tagResult;
    confidence = 0.7;
  } else if (titleResult) {
    selected = { ...titleResult, matched: `title:${titleResult.matched}` };
    confidence = 0.68;
  } else {
    selected = { id: 'unknown', matched: '' };
    confidence = 0.2;
  }

  const theme = themeFor(selected.id);
  return {
    id: selected.id,
    ...theme,
    matched: selected.matched,
    confidence
  };
}

module.exports = {
  classifyGenre,
  normalize,
  canonicalArtist,
  displayArtistName,
  ARTIST_HINTS,
  ARTIST_ALIASES,
  RULES
};
