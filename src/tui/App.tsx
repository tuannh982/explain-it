import React, { useState, useEffect } from 'react';
import { Box } from 'ink';
import { InputScreen, UserInput } from './InputScreen.js';
import { ProgressScreen } from './ProgressScreen.js';
import { OutputScreen } from './OutputScreen.js';
import { ErrorScreen } from './ErrorScreen.js';
import { ClarificationScreen } from './ClarificationScreen.js';
import { Orchestrator } from '../core/orchestrator.js';
import { config } from '../config/config.js';

export const App = () => {
    const [screen, setScreen] = useState<'input' | 'progress' | 'output' | 'error' | 'clarification'>('input');
    const [orchestrator] = useState(() => new Orchestrator(config.paths.output));
    const [outputDir, setOutputDir] = useState('');
    const [error, setError] = useState<Error | null>(null);
    const [clarificationData, setClarificationData] = useState<{ question: string; options?: string[] } | null>(null);

    useEffect(() => {
        const events = orchestrator.getEvents();
        const handleRequestInput = (payload: any) => {
            setClarificationData({
                question: payload.question,
                options: payload.options
            });
            setScreen('clarification');
        };

        events.on('request_input', handleRequestInput);

        return () => {
            // events.off('request_input', handleRequestInput);
        };
    }, [orchestrator]);

    const handleStart = async (input: UserInput) => {
        setScreen('progress');
        try {
            await orchestrator.start(input.query);
            setOutputDir(config.paths.output);
            setScreen('output');
        } catch (err: any) {
            setError(err);
            setScreen('error');
        }
    };

    const handleClarificationSubmit = (answer: string) => {
        setScreen('progress');
        setClarificationData(null);
        orchestrator.resolveInput(answer);
    };

    return (
        <Box flexDirection="column">
            {screen === 'input' && <InputScreen onSubmit={handleStart} />}
            {screen === 'progress' && <ProgressScreen events={orchestrator.getEvents()} />}
            {screen === 'clarification' && clarificationData && (
                <ClarificationScreen
                    question={clarificationData.question}
                    options={clarificationData.options}
                    onSubmit={handleClarificationSubmit}
                />
            )}
            {screen === 'output' && <OutputScreen outputPath={outputDir} />}
            {screen === 'error' && error && <ErrorScreen error={error} />}
        </Box>
    );
};
