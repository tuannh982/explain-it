import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

interface OutputScreenProps {
    outputPath: string;
}

export const OutputScreen: React.FC<OutputScreenProps> = ({ outputPath }) => {
    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
            <Gradient name="summer">
                <BigText text="Success!" />
            </Gradient>

            <Box marginY={1}>
                <Text>Your learning guide has been generated successfully.</Text>
            </Box>

            <Box flexDirection="column" padding={1} borderStyle="single">
                <Text bold>Output Location:</Text>
                <Text color="blue" underline>{outputPath}</Text>
            </Box>

            <Box marginTop={1}>
                <Text>To view it, run: </Text>
                <Text color="yellow">mkdocs serve</Text>
            </Box>
        </Box>
    );
};
