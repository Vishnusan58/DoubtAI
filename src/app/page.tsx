"use client";

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import ChatInterface from '../components/ChatInterface';
import { MessageSquare } from 'lucide-react';

// const Logo = () => (
//     <Image src="/src/components/ui/log.png" alt="RAG Bot Logo" width={100} height={100} />
// );

export default function RagBotPage() {
    const [currentYear, setCurrentYear] = useState('');
    const [isChatVisible, setIsChatVisible] = useState(false);

    useEffect(() => {
        setCurrentYear(new Date().getFullYear().toString());
    }, []);

    const toggleChatVisibility = () => {
        setIsChatVisible(!isChatVisible);
    };

    const bodyStyle: React.CSSProperties = {
        fontFamily: "'Inter', sans-serif",
        backgroundColor: '#1a1a2e', // Dark blue background
        color: 'white',
    };

    const heroBgShapeStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: '50%',
        height: '100%',
        backgroundColor: '#4361ee', // Accent color
        clipPath: 'ellipse(80% 100% at 100% 70%)',
        zIndex: 0,
    };

    const heroImageStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: 0,
        right: '5%',
        width: 'auto',
        height: '70%',
        maxHeight: '450px',
        objectFit: 'contain',
        objectPosition: 'bottom right',
        zIndex: 1,
    };

    return (
        <>
            <Head>
                <title>RAG Bot - Knowledge Assistant</title>
                <meta name="description" content="RAG Bot - Your customizable knowledge assistant powered by vector database retrieval." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div style={bodyStyle} className="min-h-screen flex flex-col relative overflow-hidden">
                <header className="absolute top-0 left-0 right-0 z-20 py-4">
                    <div className="container mx-auto px-6 flex justify-between items-center">
                        <div className="text-2xl font-bold">
                            {/*<Logo />*/}
                        </div>
                        <nav className="hidden md:flex items-center">
                            <a href="#" className="px-3 py-2 text-sm font-medium text-white hover:text-blue-300 transition-colors">Features</a>
                            <a href="#" className="px-3 py-2 text-sm font-medium text-white hover:text-blue-300 transition-colors">Documentation</a>
                            <a href="#" className="px-3 py-2 text-sm font-medium text-white hover:text-blue-300 transition-colors">Integrations</a>
                            <a href="#" className="px-3 py-2 text-sm font-medium text-white hover:text-blue-300 transition-colors">Contact</a>
                        </nav>
                        <div className="flex items-center">
                            <button className="px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-blue-500 text-white hover:bg-blue-600">
                                Get Started
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-grow flex items-center relative pt-20 pb-10 md:pt-32 md:pb-20">
                    <div className="container mx-auto px-6 relative z-10">
                        <div className="max-w-xl lg:max-w-2xl">
                            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4">
                                Retrieve and <br className="hidden md:inline" />Generate with <br className="hidden md:inline" />Precision.
                            </h1>
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-blue-400 mb-6">
                                Knowledge at your fingertips.
                            </h2>
                            <p className="text-base md:text-lg leading-relaxed mb-8 max-w-md lg:max-w-lg text-slate-200">
                                Our RAG Bot combines the power of retrieval-augmented generation with your custom knowledge base.
                                Simply swap in your vector database and transform how your users interact with your content.
                                Built for developers, designed for end-users, and optimized for accuracy.
                            </p>
                            <button
                                id="openChatBtn"
                                onClick={toggleChatVisibility}
                                className="bg-blue-500 text-white font-semibold px-8 py-3 rounded-md hover:bg-blue-400 transition-colors text-lg flex items-center"
                            >
                                <MessageSquare className="mr-2" size={20} />
                                Try RAG Bot Now
                            </button>
                        </div>
                    </div>

                    <div style={heroBgShapeStyle}></div>
                    <Image
                        src="/public/images/file.svg"
                        alt="RAG Bot Illustration"
                        width={400}
                        height={450}
                        style={heroImageStyle}
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                    />
                </main>

                <footer className="py-6 text-center text-sm text-slate-400 z-10 relative">
                    <p>&copy; {currentYear} RAG Bot. All rights reserved.</p>
                    <p className="mt-1">
                        <a href="#" className="hover:text-blue-300 mx-2">Privacy Policy</a>
                        <a href="#" className="hover:text-blue-300 mx-2">Terms of Service</a>
                        <a href="#" className="hover:text-blue-300 mx-2">Documentation</a>
                    </p>
                </footer>
            </div>

            <ChatInterface
                isVisible={isChatVisible}
                onClose={toggleChatVisibility}
            />
        </>
    );
}