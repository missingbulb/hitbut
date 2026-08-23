import { render } from 'preact';
import type { JSX } from 'preact';
import './styles.css';
import { matchRoute, useRoute } from './router.tsx';
import { NotFound } from './components.tsx';
import { stringsFor } from './strings.ts';
import { Home } from './pages/Home.tsx';
import { Figure } from './pages/Figure.tsx';
import { Utterance } from './pages/Utterance.tsx';
import { Finding } from './pages/Finding.tsx';
import { Search } from './pages/Search.tsx';
import { Methodology } from './pages/Methodology.tsx';

function App(): JSX.Element {
  const route = useRoute();

  if (route.path === '/') return <Home />;
  if (route.path === '/search') return <Search query={route.query.get('q') ?? ''} />;
  if (route.path === '/methodology') return <Methodology />;

  const figure = matchRoute(route.path, '/figures');
  if (figure) return <Figure id={figure} />;

  const utterance = matchRoute(route.path, '/utterances');
  if (utterance) return <Utterance id={utterance} />;

  const finding = matchRoute(route.path, '/findings');
  if (finding) return <Finding id={finding} />;

  return <NotFound strings={stringsFor('he')} />;
}

render(<App />, document.getElementById('app')!);
