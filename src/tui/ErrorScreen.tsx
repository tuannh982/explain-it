import React from 'react';
import { Box, Text } from 'ink';

interface ErrorScreenProps {
    error: Error;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error }) => {
    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="red">
            <Text bold color="red">Fatal Error Occurred</Text>
            <Box marginY={1}>
                <Text>{error.message}</Text>
            </Box>
            <Text color="gray">{error.stack}</Text>
        </Box>
    );
};
