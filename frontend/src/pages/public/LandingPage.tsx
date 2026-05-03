import { MotionConfig } from 'framer-motion';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Hero } from './landing/Hero';
import { Intro } from './landing/Intro';
import { Portals } from './landing/Portals';
import { Steps } from './landing/Steps';
import { Footer } from './landing/Footer';
import { ChatbotWidget } from '../../components/chatbot/ChatbotWidget';

export default function LandingPage() {
  useDocumentTitle('Home');

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-white text-slate-900">
        <Hero />
        <Intro />
        <Portals />
        <Steps />
        <Footer />
        <ChatbotWidget />
      </div>
    </MotionConfig>
  );
}
