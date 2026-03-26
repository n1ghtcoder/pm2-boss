export interface TelegramConfig {
	botToken: string;
	chatIds: string[];
	enabled: boolean;
}

export interface ProcessAlert {
	type: "crash" | "restart_loop" | "exit";
	processName: string;
	pmId: number;
	exitCode?: number;
	restarts?: number;
	message: string;
}
