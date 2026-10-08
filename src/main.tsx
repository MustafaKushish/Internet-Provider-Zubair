import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DialogHost } from './components/ui/Dialogs';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <DialogHost />
  </>,
);
