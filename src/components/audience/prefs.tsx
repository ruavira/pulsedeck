'use client';
// Participant accessibility + language preferences: text size, high contrast,
// reduced motion, and UI language (with RTL support). Persists per device.
// Applied globally by wrapping the audience app — individual views need no edits
// for text-size/contrast/motion. Language translates core chrome strings; live
// translation of the presenter's question is a future add-on (needs a MT key).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ---- tiny i18n catalogue for core chrome strings ----
type Lang = 'en' | 'fr' | 'es' | 'pt' | 'ar' | 'sw';
const LANGS: { id: Lang; label: string; dir: 'ltr' | 'rtl' }[] = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'fr', label: 'Français', dir: 'ltr' },
  { id: 'es', label: 'Español', dir: 'ltr' },
  { id: 'pt', label: 'Português', dir: 'ltr' },
  { id: 'sw', label: 'Kiswahili', dir: 'ltr' },
  { id: 'ar', label: 'العربية', dir: 'rtl' },
];

type Key =
  | 'waiting'
  | 'youreIn'
  | 'onlyNickname'
  | 'a11y'
  | 'textSize'
  | 'contrast'
  | 'reduceMotion'
  | 'language'
  | 'on'
  | 'off'
  | 'done'
  | 'translateSoon';

const DICT: Record<Lang, Record<Key, string>> = {
  en: {
    waiting: 'Waiting for the presenter to start…',
    youreIn: "You're in",
    onlyNickname: 'Only your nickname is visible',
    a11y: 'Display & language',
    textSize: 'Text size',
    contrast: 'High contrast',
    reduceMotion: 'Reduce motion',
    language: 'Language',
    on: 'On',
    off: 'Off',
    done: 'Done',
    translateSoon: 'Live question translation is coming soon.',
  },
  fr: {
    waiting: "En attente du présentateur…",
    youreIn: 'Vous êtes connecté',
    onlyNickname: 'Seul votre pseudo est visible',
    a11y: 'Affichage et langue',
    textSize: 'Taille du texte',
    contrast: 'Contraste élevé',
    reduceMotion: 'Réduire les animations',
    language: 'Langue',
    on: 'Activé',
    off: 'Désactivé',
    done: 'Terminé',
    translateSoon: 'La traduction en direct arrive bientôt.',
  },
  es: {
    waiting: 'Esperando a que empiece el presentador…',
    youreIn: 'Estás dentro',
    onlyNickname: 'Solo se ve tu apodo',
    a11y: 'Pantalla e idioma',
    textSize: 'Tamaño del texto',
    contrast: 'Alto contraste',
    reduceMotion: 'Reducir animación',
    language: 'Idioma',
    on: 'Sí',
    off: 'No',
    done: 'Listo',
    translateSoon: 'La traducción en vivo llegará pronto.',
  },
  pt: {
    waiting: 'Aguardando o apresentador começar…',
    youreIn: 'Você entrou',
    onlyNickname: 'Apenas o seu apelido é visível',
    a11y: 'Tela e idioma',
    textSize: 'Tamanho do texto',
    contrast: 'Alto contraste',
    reduceMotion: 'Reduzir animação',
    language: 'Idioma',
    on: 'Sim',
    off: 'Não',
    done: 'Concluído',
    translateSoon: 'A tradução ao vivo chega em breve.',
  },
  sw: {
    waiting: 'Tunasubiri mwasilishaji aanze…',
    youreIn: 'Umeingia',
    onlyNickname: 'Jina lako la utani pekee linaonekana',
    a11y: 'Onyesho na lugha',
    textSize: 'Ukubwa wa maandishi',
    contrast: 'Utofautishaji wa juu',
    reduceMotion: 'Punguza mwendo',
    language: 'Lugha',
    on: 'Washa',
    off: 'Zima',
    done: 'Imekamilika',
    translateSoon: 'Tafsiri ya moja kwa moja inakuja hivi karibuni.',
  },
  ar: {
    waiting: 'في انتظار بدء المُقدِّم…',
    youreIn: 'لقد انضممت',
    onlyNickname: 'اسمك المستعار فقط ظاهر',
    a11y: 'العرض واللغة',
    textSize: 'حجم النص',
    contrast: 'تباين عالٍ',
    reduceMotion: 'تقليل الحركة',
    language: 'اللغة',
    on: 'مفعّل',
    off: 'مغلق',
    done: 'تم',
    translateSoon: 'الترجمة الفورية للسؤال قادمة قريباً.',
  },
};

const ZOOMS = [0.9, 1, 1.15, 1.3];

interface Prefs {
  size: number; // index into ZOOMS
  contrast: boolean;
  reduceMotion: boolean;
  lang: Lang;
}
interface Ctx extends Prefs {
  setSize: (n: number) => void;
  setContrast: (b: boolean) => void;
  setReduceMotion: (b: boolean) => void;
  setLang: (l: Lang) => void;
  open: () => void;
  t: (k: Key) => string;
}

const PrefsContext = createContext<Ctx | null>(null);
export const useAudiencePrefs = () => {
  const c = useContext(PrefsContext);
  if (!c) throw new Error('useAudiencePrefs outside provider');
  return c;
};

const LS = 'pd_prefs';

export function AudiencePrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>({ size: 1, contrast: false, reduceMotion: false, lang: 'en' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);
  const save = useCallback((next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(LS, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const lang = prefs.lang;
  const dir = LANGS.find((l) => l.id === lang)?.dir ?? 'ltr';
  const t = useCallback((k: Key) => DICT[lang]?.[k] ?? DICT.en[k], [lang]);

  const ctx = useMemo<Ctx>(
    () => ({
      ...prefs,
      setSize: (n) => save({ ...prefs, size: Math.max(0, Math.min(ZOOMS.length - 1, n)) }),
      setContrast: (b) => save({ ...prefs, contrast: b }),
      setReduceMotion: (b) => save({ ...prefs, reduceMotion: b }),
      setLang: (l) => save({ ...prefs, lang: l }),
      open: () => setOpen(true),
      t,
    }),
    [prefs, save, t],
  );

  return (
    <PrefsContext.Provider value={ctx}>
      <div
        lang={lang}
        dir={dir}
        className={`${prefs.contrast ? 'pd-contrast' : ''} ${prefs.reduceMotion ? 'pd-reduce-motion' : ''}`}
        style={{ zoom: ZOOMS[prefs.size] } as React.CSSProperties}
      >
        {children}
      </div>
      {open && <AccessibilitySheet onClose={() => setOpen(false)} ctx={ctx} langs={LANGS} zoomCount={ZOOMS.length} />}
    </PrefsContext.Provider>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm font-semibold text-fg">{label}</span>
      {children}
    </div>
  );
}

function AccessibilitySheet({
  onClose,
  ctx,
  langs,
  zoomCount,
}: {
  onClose: () => void;
  ctx: Ctx;
  langs: { id: Lang; label: string; dir: 'ltr' | 'rtl' }[];
  zoomCount: number;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ctx.t('a11y')}
        className="w-full max-w-md rounded-t-3xl border border-edge bg-panel p-5 pb-8 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">{ctx.t('a11y')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={ctx.t('done')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-fg-dim hover:bg-panel-2 hover:text-fg"
          >
            ×
          </button>
        </div>

        <div className="divide-y divide-edge">
          <Row label={ctx.t('textSize')}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Smaller"
                onClick={() => ctx.setSize(ctx.size - 1)}
                disabled={ctx.size === 0}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-sm font-bold disabled:opacity-40"
              >
                A−
              </button>
              <span className="w-6 text-center text-sm tabular-nums text-fg-dim">{ctx.size + 1}</span>
              <button
                type="button"
                aria-label="Larger"
                onClick={() => ctx.setSize(ctx.size + 1)}
                disabled={ctx.size === zoomCount - 1}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-base font-bold disabled:opacity-40"
              >
                A+
              </button>
            </div>
          </Row>

          <Row label={ctx.t('contrast')}>
            <Toggle on={ctx.contrast} onChange={ctx.setContrast} labels={[ctx.t('on'), ctx.t('off')]} />
          </Row>

          <Row label={ctx.t('reduceMotion')}>
            <Toggle on={ctx.reduceMotion} onChange={ctx.setReduceMotion} labels={[ctx.t('on'), ctx.t('off')]} />
          </Row>

          <div className="py-3">
            <p className="mb-2 text-sm font-semibold text-fg">{ctx.t('language')}</p>
            <div className="flex flex-wrap gap-2">
              {langs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => ctx.setLang(l.id)}
                  className={`min-h-[40px] rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    l.id === ctx.lang
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-edge text-fg-dim'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-fg-dim">{ctx.t('translateSoon')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-accent py-3.5 text-center font-bold text-white"
        >
          {ctx.t('done')}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  labels,
}: {
  on: boolean;
  onChange: (b: boolean) => void;
  labels: [string, string];
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? labels[0] : labels[1]}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-panel-2 border border-edge'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}
