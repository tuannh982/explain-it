import { Box, Text, useInput } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import type React from "react";

interface OutputScreenProps {
	outputPath: string;
	sessionStatus?: "completed" | "failed";
	onQuit?: () => void;
}

export const OutputScreen: React.FC<OutputScreenProps> = ({
	outputPath,
	sessionStatus = "completed",
	onQuit,
}) => {
	useInput((input, key) => {
		if ((key.escape || input === "q") && onQuit) {
			onQuit();
		}
	});

	const isCompleted = sessionStatus === "completed";
	const isFailed = sessionStatus === "failed";

	const getBorderColor = () => {
		if (isCompleted) return "green";
		if (isFailed) return "red";
		return "gray";
	};

	const getTitle = () => {
		if (isCompleted) return "Success!";
		if (isFailed) return "Failed";
		return "Session";
	};

	const getGradient = () => {
		if (isCompleted) return "summer";
		if (isFailed) return "retro";
		return "pastel";
	};

	const getMessage = () => {
		if (isCompleted)
			return "Your learning guide has been generated successfully.";
		if (isFailed)
			return "This session failed. Check the output folder for partial results.";
		return "Session output";
	};

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="round"
			borderColor={getBorderColor()}
		>
			<Gradient name={getGradient()}>
				<BigText text={getTitle()} />
			</Gradient>

			<Box marginY={1}>
				<Text>{getMessage()}</Text>
			</Box>

			<Box flexDirection="column" padding={1} borderStyle="single">
				<Text bold>Output Location:</Text>
				<Text color="blue" underline>
					{outputPath}
				</Text>
			</Box>

			{isCompleted && (
				<Box marginTop={1}>
					<Text>To view it, run: </Text>
					<Text color="yellow">mkdocs serve</Text>
				</Box>
			)}

			<Box marginTop={1} flexDirection="column">
				{onQuit && <Text color="gray">[Esc/q] Quit</Text>}
			</Box>
		</Box>
	);
};
