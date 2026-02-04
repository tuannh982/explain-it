import { Box, Text, useApp } from "ink";
import { useEffect, useState } from "react";
import { config } from "../config/config.js";
import { Orchestrator } from "../core/orchestrator.js";
import { type ResumeData, SessionManager } from "../core/session-manager.js";
import type { Session } from "../core/session-types.js";
import { DashboardScreen } from "./DashboardScreen.js";
import { ErrorScreen } from "./ErrorScreen.js";
import { InputScreen, type UserInput } from "./InputScreen.js";
import { OutputScreen } from "./OutputScreen.js";
import { ProgressScreen } from "./ProgressScreen.js";

type Screen = "dashboard" | "input" | "progress" | "output" | "error";

interface RunningSession {
	session: Session;
	orchestrator: Orchestrator;
}

export const App = () => {
	const { exit } = useApp();

	const [screen, setScreen] = useState<Screen>("dashboard");
	const [sessionManager] = useState(
		() => new SessionManager(config.paths.sessionsFile, config.paths.root),
	);
	const [runningSessions, setRunningSessions] = useState<
		Map<string, RunningSession>
	>(() => new Map());
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
		null,
	);
	const [isLoaded, setIsLoaded] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [resumeData, setResumeData] = useState<ResumeData | null>(null);

	// Load sessions on mount
	useEffect(() => {
		sessionManager.load().then(() => {
			setIsLoaded(true);
		});
	}, [sessionManager]);

	// Computed values
	const activeSessions = sessionManager.getActiveSessions();
	const archivedSessions = sessionManager.getArchivedSessions();

	const selectedSession: RunningSession | Session | undefined =
		selectedSessionId
			? runningSessions.get(selectedSessionId) ||
				sessionManager.getSession(selectedSessionId)
			: undefined;

	// Get the actual Session object (whether from RunningSession or direct)
	const getSessionData = (): Session | undefined => {
		if (!selectedSession) return undefined;
		if ("session" in selectedSession) {
			return selectedSession.session;
		}
		return selectedSession;
	};

	// Get orchestrator for the selected session (only if it's running)
	const getSelectedOrchestrator = (): Orchestrator | undefined => {
		if (!selectedSessionId) return undefined;
		const running = runningSessions.get(selectedSessionId);
		return running?.orchestrator;
	};

	// Handlers
	const handleNewSession = () => {
		setScreen("input");
	};

	const handleSelectSession = (session: Session) => {
		setSelectedSessionId(session.id);

		// Navigate based on session status
		switch (session.status) {
			case "running":
				setScreen("progress");
				break;
			case "completed":
				setScreen("output");
				break;
			case "failed":
			case "interrupted":
				// For failed/interrupted, show output if available, otherwise dashboard
				setScreen("output");
				break;
			default:
				setScreen("dashboard");
		}
	};

	const handleStartSession = async (input: UserInput) => {
		try {
			// Create session in session manager
			const session = await sessionManager.createSession(
				input.query,
				input.persona,
				input.depth,
			);

			// Create orchestrator for this session
			const orchestrator = new Orchestrator(session.id, session.folderPath);

			// Add to running sessions
			const newRunning: RunningSession = { session, orchestrator };
			setRunningSessions((prev) => {
				const next = new Map(prev);
				next.set(session.id, newRunning);
				return next;
			});

			// Set as selected and show progress
			setSelectedSessionId(session.id);
			setScreen("progress");

			// Start processing in background after a brief delay to ensure
			// ProgressScreen has mounted and subscribed to events
			setTimeout(() => {
				orchestrator
					.process(input.query, input.depth, input.persona)
					.then(async () => {
						// Update session status to completed
						await sessionManager.updateSession(session.id, {
							status: "completed",
							completedAt: new Date().toISOString(),
						});
						// Remove from running sessions
						setRunningSessions((prev) => {
							const next = new Map(prev);
							next.delete(session.id);
							return next;
						});
						// If still viewing this session, update screen
						if (selectedSessionId === session.id) {
							setScreen("output");
						}
					})
					.catch(async (err: unknown) => {
						const errorMessage =
							err instanceof Error ? err.message : String(err);
						await sessionManager.updateSession(session.id, {
							status: "failed",
							completedAt: new Date().toISOString(),
							error: errorMessage,
						});
						// Remove from running sessions
						setRunningSessions((prev) => {
							const next = new Map(prev);
							next.delete(session.id);
							return next;
						});
						// If still viewing this session, show error
						if (selectedSessionId === session.id) {
							setError(err instanceof Error ? err : new Error(String(err)));
							setScreen("error");
						}
					});
			}, 0);
		} catch (err: unknown) {
			setError(err instanceof Error ? err : new Error(String(err)));
			setScreen("error");
		}
	};

	const handleBackToDashboard = () => {
		setSelectedSessionId(null);
		setResumeData(null);
		setScreen("dashboard");
	};

	const handleResumeSession = async () => {
		const session = getSessionData();
		if (!session || session.status !== "interrupted") return;

		try {
			// Load previous state and logs for display
			const loadedResumeData = await sessionManager.loadResumeData(session);
			setResumeData(loadedResumeData);

			// Update session status back to running
			await sessionManager.updateSession(session.id, {
				status: "running",
			});

			// Create a new orchestrator for the resumed session
			const orchestrator = new Orchestrator(session.id, session.folderPath);

			// Add to running sessions
			const newRunning: RunningSession = {
				session: { ...session, status: "running" },
				orchestrator,
			};
			setRunningSessions((prev) => {
				const next = new Map(prev);
				next.set(session.id, newRunning);
				return next;
			});

			// Show progress screen
			setScreen("progress");

			// Resume processing after a brief delay to ensure
			// ProgressScreen has mounted and subscribed to events
			setTimeout(() => {
				orchestrator
					.process(session.topic, session.depth, session.persona)
					.then(async () => {
						await sessionManager.updateSession(session.id, {
							status: "completed",
							completedAt: new Date().toISOString(),
						});
						setRunningSessions((prev) => {
							const next = new Map(prev);
							next.delete(session.id);
							return next;
						});
						if (selectedSessionId === session.id) {
							setScreen("output");
						}
					})
					.catch(async (err: unknown) => {
						const errorMessage =
							err instanceof Error ? err.message : String(err);
						await sessionManager.updateSession(session.id, {
							status: "failed",
							completedAt: new Date().toISOString(),
							error: errorMessage,
						});
						setRunningSessions((prev) => {
							const next = new Map(prev);
							next.delete(session.id);
							return next;
						});
						if (selectedSessionId === session.id) {
							setError(err instanceof Error ? err : new Error(String(err)));
							setScreen("error");
						}
					});
			}, 0);
		} catch (err: unknown) {
			setError(err instanceof Error ? err : new Error(String(err)));
			setScreen("error");
		}
	};

	const handleQuit = () => {
		// Mark running sessions as interrupted (fire and forget to ensure quick exit)
		for (const [sessionId] of runningSessions) {
			sessionManager.updateSession(sessionId, {
				status: "interrupted",
			});
		}
		exit();
	};

	const handleDeleteSession = async (session: Session) => {
		// Don't delete running sessions
		if (runningSessions.has(session.id)) {
			return;
		}
		// Remove from sessions.json only, keep the files
		await sessionManager.deleteSession(session.id);
	};

	// Loading state
	if (!isLoaded) {
		return (
			<Box padding={1}>
				<Text>Loading sessions...</Text>
			</Box>
		);
	}

	// First-time user flow: if no sessions exist and on dashboard, show InputScreen directly
	const hasNoSessions =
		activeSessions.length === 0 && archivedSessions.length === 0;
	if (hasNoSessions && screen === "dashboard") {
		return (
			<Box flexDirection="column">
				<InputScreen
					onSubmit={handleStartSession}
					orchestrator={new Orchestrator("temp", config.paths.root)}
				/>
			</Box>
		);
	}

	// Get session data for rendering
	const sessionData = getSessionData();
	const selectedOrchestrator = getSelectedOrchestrator();

	return (
		<Box flexDirection="column">
			{screen === "dashboard" && (
				<DashboardScreen
					activeSessions={activeSessions}
					archivedSessions={archivedSessions}
					onSelectSession={handleSelectSession}
					onNewSession={handleNewSession}
					onDeleteSession={handleDeleteSession}
					onQuit={handleQuit}
				/>
			)}
			{screen === "input" && (
				<InputScreen
					onSubmit={handleStartSession}
					orchestrator={new Orchestrator("temp", config.paths.root)}
					onCancel={handleBackToDashboard}
				/>
			)}
			{screen === "progress" && selectedOrchestrator && (
				<ProgressScreen
					events={selectedOrchestrator.getEvents()}
					sessionTopic={sessionData?.topic}
					onBack={handleBackToDashboard}
					initialNodes={resumeData?.nodes}
					initialLogs={resumeData?.logs}
				/>
			)}
			{screen === "output" && sessionData && (
				<OutputScreen
					outputPath={sessionData.folderPath}
					onBack={handleBackToDashboard}
					sessionStatus={sessionData.status}
					onResume={handleResumeSession}
				/>
			)}
			{screen === "error" && error && <ErrorScreen error={error} />}
		</Box>
	);
};
