export interface Config {
    appName: string;
}
export declare function main(args: string[], options?: Partial<Config>): Promise<void>;
export declare function cliRunDefault(options?: Partial<Config>): void;
