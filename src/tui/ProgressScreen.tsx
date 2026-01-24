import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { EventSystem } from '../core/events.js';

interface ProgressScreenProps {
    events: EventSystem;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ events }) => {
    const [phase, setPhase] = useState('Initializing...');
    const [logs, setLogs] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState('');

    useEffect(() => {
        events.on('phase_start', (p: any) => {
            setPhase(p.phase?.toUpperCase() || 'UNKNOWN');
            addLog(`>>> Phase: ${p.phase}`);
        });

        events.on('step_progress', (p: any) => {
            setCurrentStep(p.message || '');
            if (p.message) addLog(`  - ${p.message}`);
        });

        events.on('error', (p: any) => {
            addLog(`ERROR: ${p.message}`);
        });
    }, []);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev.slice(-8), msg]); // Keep last 8 logs
    };

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
            <Box>
                <Text color="green"><Spinner type="dots" /> </Text>
                <Text bold color="white"> {phase}</Text>
            </Box>

            {currentStep && (
                <Box marginY={1}>
                    <Text color="blue">Activity: {currentStep}</Text>
                </Box>
            )}

            <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                {logs.map((log, i) => (
                    <Text key={i} color="gray">{log}</Text>
                ))}
            </Box>
        </Box>
    );
};
