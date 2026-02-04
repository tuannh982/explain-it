import { Box, Text, useInput } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import type React from "react";

interface OutputScreenProps {
	outputPath: string;
	onBack?: () => void;
}

export const OutputScreen: React.FC<OutputScreenProps> = ({
	outputPath,
	onBack,
}) => {
	// Handle escape/b key to go back
	useInput((_input, key) => {
		if ((key.escape || _input === "b") && onBack) {
			onBack();
		}
	});
	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor="green"
		>
			<Gradient name="summer">
				<BigText text="Success!" />
			</Gradient>

			<Box marginY={1}>
				<Text>Your learning guide has been generated successfully.</Text>
			</Box>

			<Box flexDirection="column" padding={1} borderStyle="single">
				<Text bold>Output Location:</Text>
				<Text color="blue" underline>
					{outputPath}
				</Text>
			</Box>

			<Box marginTop={1}>
				<Text>To view it, run: </Text>
				<Text color="yellow">mkdocs serve</Text>
			</Box>

			{onBack && (
				<Box marginTop={1}>
					<Text color="gray">[Esc/b] Back to Dashboard</Text>
				</Box>
			)}
		</Box>
	);
};
