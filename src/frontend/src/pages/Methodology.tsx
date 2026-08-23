// The page every flag links to. It has one job: say plainly what a flag confirms and what
// it does not, on the page a reader reaches straight from the flag — and put the way to
// tell us we are wrong immediately beside it.
import type { JSX } from 'preact';
import type { FigureSummary, Page } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Shell } from '../components.tsx';
import { stringsFor } from '../strings.ts';

const REPORT_URL = 'https://github.com/missingbulb/hitbut/issues';

export function Methodology(): JSX.Element {
  const strings = stringsFor('he');
  const roster = useResource<Page<FigureSummary>>('/figures');

  return (
    // Not ready until the roster has landed. `data-ready` is this page's own statement that
    // it has finished rendering — the capture harness waits on it, and a page that says it
    // while a fetch is still in flight is a page that gets screenshotted half-drawn.
    <Shell ready={roster.state !== 'loading'}>
      <article class="prose" style="padding-block-start: 40px">
        <h1 class="page-title">איך זה עובד</h1>

        <h2>{strings.rosterTitle}</h2>
        <p>{strings.rosterLede}</p>
        {roster.state === 'ready' && roster.value.items.length > 0 ? (
          <dl class="roster">
            {roster.value.items.map((figure) => (
              <div class="roster__entry" key={figure.id}>
                <dt class="roster__who">
                  <Link href={`/figures/${figure.id}`}>{figure.displayName}</Link>
                  <span class="meta"> · {figure.role}</span>
                </dt>
                <dd class="roster__why">{figure.qualifies}</dd>
              </div>
            ))}
          </dl>
        ) : (
          roster.state !== 'loading' && <p>{strings.rosterEmpty}</p>
        )}

        <h2>מאיפה מגיעות ההתבטאויות</h2>
        <p>
          ההתבטאויות נאספות ממקורות פומביים — פרוטוקולים, הודעות, פרסומים ושידורים. העמוד או הקובץ המקורי
          נשמר אצלנו כפי שהוא, לפני שתוכנה כלשהי מפרשת אותו, כך שאפשר לחזור אליו ולבדוק מה בדיוק נכתב שם.
          לכל התבטאות באתר יש קישור למקור שממנו נלקחה.
        </p>
        <p>
          כשמקור לא מציין מתי נאמר משהו, לא נמציא תאריך: כתוב «תאריך לא ידוע», וההתבטאות ממוינת אחרי כל
          אלה שכן תוארכו.
        </p>

        <h2>מה בעצם מסומן</h2>
        <p>
          שתי התבטאויות של אותה דמות שנוגעות לאותו נושא נקראות יחד על ידי מודל שפה, שאומר אם הן מתנגשות
          («סתירה»), אם מדובר בשינוי עמדה לאורך זמן («שינוי עמדה»), או ששתיהן יכולות להתקיים יחד. כל סימון
          נשמר עם שני המזהים של ההתבטאויות, עם ההנמקה, ועם גרסת המודל וגרסת ההנחיה שהפיקו אותו — כדי
          שתמיד יהיה אפשר לראות מה בדיוק הושווה ולמה.
        </p>

        <h2>מה הסימון לא אומר</h2>
        <p>
          <strong>
            המודל משווה שני ציטוטים שחילצנו משני מקורות ואומר למה לדעתו הם מתנגשים. הוא לא יודע מה הדובר
            התכוון, הוא לא שומע נימה, הוא לא רואה הקשר שלא נכתב — והוא יכול לטעות.
          </strong>{' '}
          סימון הוא הזמנה לקרוא את שני הציטוטים ואת המקורות שלהם, לא מסקנה סופית. שני הציטוטים והמקורות
          מופיעים בעמוד הסימון בדיוק כדי שאפשר יהיה לבדוק אותו.
        </p>

        <h2>למצוא טעות ולדווח עליה</h2>
        <p>
          אם ציטוט שגוי, מיוחס לדמות הלא נכונה, נחתך באופן שמשנה את משמעותו, או שסימון פשוט לא נכון —{' '}
          <a href={REPORT_URL} rel="noopener" target="_blank">
            אפשר לדווח כאן
          </a>
          . כדאי לצרף את הקישור לעמוד ואת המזהה שמופיע בו.
        </p>

        <h2>מה קורה לקישורים ישנים</h2>
        <p>
          מזהה לא ממוחזר ולא נמחק. אם מודל חדש קורא מחדש צמד התבטאויות, הסימון הישן נשמר, מסומן כמי
          שהוחלף, ומפנה לחדש — כדי שהפניה שנעשתה אליו בעבר תמשיך לעבוד. דמות שהוסרה מהאתר נשארת נגישה
          לפי המזהה שלה, עם הערה שהרשומה הוסרה.
        </p>

        <h2>חיפוש בעברית</h2>
        <p>
          עברית מדביקה את מילות היחס לתחילת המילה, ומנוע החיפוש שמתחת לאתר לא יודע על כך דבר. לכן אנחנו
          מקפלים את הטקסט בעצמנו לפני האינדוקס וגם בזמן החיפוש: «בכנסת» ו«כנסת» הן אותה מילה, אותיות סופיות
          נחשבות זהות לרגילות, וניקוד וגרשיים מוסרים. המחיר הוא שלפעמים מילים שונות חולקות אותו גזע ומופיעות
          זו בתוצאות של זו.
        </p>
      </article>
    </Shell>
  );
}
