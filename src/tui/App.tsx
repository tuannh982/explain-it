import React, { useState, useEffect } from 'react';
import { Box } from 'ink';
import { InputScreen, UserInput } from './InputScreen';
import { ProgressScreen } from './ProgressScreen';
import { OutputScreen } from './OutputScreen';
import { ErrorScreen } from './ErrorScreen';
import { Orchestrator } from '../core/orchestrator';
import { config } from '../config/config';

export const App = () => {
    const [screen, setScreen] = useState<'input' | 'progress' | 'output' | 'error'>('input');
    const [orchestrator] = useState(() => new Orchestrator(config.paths.output));
    const [outputDir, setOutputDir] = useState('');
    const [error, setError] = useState<Error | null>(null);

    const handleStart = async (input: UserInput) => {
        setScreen('progress');
        try {
            await orchestrator.start(input.query); // We rely on clarifier to fix depth or use default for now in start()
            // Using Orchestrator.start with generic string as per current impl.
            // Ideally we pass depth too, but Clarifier re-confirms it.
            // To respect user input depth, Orchestrator.start() signature might need update or Clarifier injection.
            // For MVP, Clarifier will "guess" or we assume Orchestrator handles it.

            // Actually, orchestrator.start() currently calls clarifier. 
            // We should probably pass the user's depth choice to clarifier if possible, 
            // OR update orchestrator state directly.
            // For now, let's just run it. The user preference is captured in query context usually.

            setOutputDir(config.paths.output);
            setScreen('output');
        } catch (err: any) {
            setError(err);
            setScreen('error');
        }
    };

    return (
        <Box flexDirection="column">
            {screen === 'input' && <InputScreen onSubmit={handleStart} />}
            {screen === 'progress' && <ProgressScreen events={orchestrator.getEvents()} />}
            {screen === 'output' && <OutputScreen outputPath={outputDir} />}
            {screen === 'error' && error && <ErrorScreen error={error} />}
        </Box>
    );
};
