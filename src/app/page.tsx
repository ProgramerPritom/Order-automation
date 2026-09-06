import React from 'react';
import Navbar from '@/components/marketing/Navbar';
import Hero from '@/components/marketing/Hero';
import PainVsRelief from '@/components/marketing/PainVsRelief';
import MultimodalSpotlight from '@/components/marketing/MultimodalSpotlight';
import LiveChatSimulation from '@/components/marketing/LiveChatSimulation';
import FeaturesBento from '@/components/marketing/FeaturesBento';
import ThreeStepSetup from '@/components/marketing/ThreeStepSetup';
import RoiCalculator from '@/components/marketing/RoiCalculator';
import PricingOffers from '@/components/marketing/PricingOffers';
import Footer from '@/components/marketing/Footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <Navbar />
      <Hero />
      <PainVsRelief />
      <MultimodalSpotlight />
      <LiveChatSimulation />
      <FeaturesBento />
      <ThreeStepSetup />
      <RoiCalculator />
      <PricingOffers />
      <Footer />
    </main>
  );
}
