// More tab (UX design §6.1): the screens that are not tabs of their own.
import { BookOpen, HistoryIcon, Info, Settings } from 'lucide-react';
import { Tile } from '../ui/primitives';
import { libraryModule } from '../modules/library/register';

export default function MoreScreen() {
  return (
    <section>
      <h1>More</h1>
      <div className="ui-stack">
        <Tile href="#/library" icon={<BookOpen />} label={libraryModule.label} value="Every exercise, how to do it" />
        <Tile href="#/history" icon={<HistoryIcon />} label="History" value="Past workouts" />
        <Tile href="#/settings" icon={<Settings />} label="Settings" value="Training, account, notifications" />
        <Tile href="#/credits" icon={<Info />} label="Credits" value="Data sources and licences" />
      </div>
    </section>
  );
}
