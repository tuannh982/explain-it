import { Box, Text, useInput } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import type React from "react";
import type { SessionStatus } from "../core/session-types.js";

interface OutputScreenProps {
	outputPath: string;
	onBack?: () => void;
	sessionStatus?: SessionStatus;
	onResume?: () => void;
}

export const OutputScreen: React.FC<OutputScreenProps> = ({
	outputPath,
	onBack,
	sessionStatus = "completed",
	onResume,
}) => {
	// Handle escape/b key to go back, r to resume
	useInput((input, key) => {
		if ((key.escape || input === "b") && onBack) {
			onBack();
		}
		if (input === "r" && onResume && sessionStatus === "interrupted") {
			onResume();
		}
	});

	const isCompleted = sessionStatus === "completed";
	const isInterrupted = sessionStatus === "interrupted";
	const isFailed = sessionStatus === "failed";

	const getBorderColor = () => {
		if (isCompleted) return "green";
		if (isInterrupted) return "yellow";
		if (isFailed) return "red";
		return "gray";
	};

	const getTitle = () => {
		if (isCompleted) return "Success!";
		if (isInterrupted) return "Interrupted";
		if (isFailed) return "Failed";
		return "Session";
	};

	const getGradient = () => {
		if (isCompleted) return "summer";
		if (isInterrupted) return "morning";
		if (isFailed) return "retro";
		return "pastel";
	};

	const getMessage = () => {
		if (isCompleted)
			return "Your learning guide has been generated successfully.";
		if (isInterrupted)
			return "This session was interrupted and can be resumed.";
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
				{onBack && <Text color="gray">[Esc/b] Back to Dashboard</Text>}
				{isInterrupted && onResume && (
					<Text color="yellow">[r] Resume Session</Text>
				)}
			</Box>
		</Box>
	);
};
