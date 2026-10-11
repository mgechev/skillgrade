import { EnvironmentProvider } from '../types';
import { DockerProvider } from './docker';
import { LocalProvider } from './local';

export type ProviderFactory = (config?: any) => EnvironmentProvider;

/** Registry of available environment provider implementations. */
export const PROVIDER_REGISTRY = new Map<string, ProviderFactory>();

/**
 * Register a custom environment provider implementation.
 * If a provider with the same name already exists, it is replaced.
 */
export function registerProvider(name: string, factory: ProviderFactory): void {
    PROVIDER_REGISTRY.set(name, factory);
}

/**
 * Resolve an environment provider instance by name.
 * Throws an error listing available providers if the name is not registered.
 */
export function getProvider(name: string, config?: any): EnvironmentProvider {
    const factory = PROVIDER_REGISTRY.get(name);
    if (!factory) {
        const available = Array.from(PROVIDER_REGISTRY.keys()).join(', ');
        throw new Error(`Unknown provider "${name}". Available: ${available}`);
    }
    return factory(config);
}

// Pre-register built-in providers
registerProvider('docker', () => new DockerProvider());
registerProvider('local', () => new LocalProvider());

export { DockerProvider } from './docker';
export { LocalProvider } from './local';
