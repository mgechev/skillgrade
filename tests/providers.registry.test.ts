import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getProvider,
    registerProvider,
    PROVIDER_REGISTRY,
    DockerProvider,
    LocalProvider,
} from '../src/providers/registry';
import { EnvironmentProvider } from '../src/types';

describe('Provider Registry', () => {
    beforeEach(() => {
        PROVIDER_REGISTRY.clear();
        registerProvider('docker', () => new DockerProvider());
        registerProvider('local', () => new LocalProvider());
    });

    it('resolves the built-in "docker" provider', () => {
        // Arrange
        const providerName = 'docker';

        // Act
        const provider = getProvider(providerName);

        // Assert
        expect(provider).toBeInstanceOf(DockerProvider);
    });

    it('resolves the built-in "local" provider', () => {
        // Arrange
        const providerName = 'local';

        // Act
        const provider = getProvider(providerName);

        // Assert
        expect(provider).toBeInstanceOf(LocalProvider);
    });

    it('throws an error listing available providers when given an unknown provider name', () => {
        // Arrange
        const unknownName = 'kubernetes';

        // Act & Assert
        expect(() => getProvider(unknownName)).toThrowError(
            'Unknown provider "kubernetes". Available: docker, local'
        );
    });

    it('registers and resolves a custom provider implementation', () => {
        // Arrange
        const customProvider: EnvironmentProvider = {
            setup: vi.fn(),
            cleanup: vi.fn(),
            runCommand: vi.fn(),
        };
        registerProvider('custom', () => customProvider);

        // Act
        const resolved = getProvider('custom');

        // Assert
        expect(resolved).toBe(customProvider);
    });

    it('allows overriding a built-in provider implementation', () => {
        // Arrange
        const mockDockerProvider: EnvironmentProvider = {
            setup: vi.fn(),
            cleanup: vi.fn(),
            runCommand: vi.fn(),
        };
        registerProvider('docker', () => mockDockerProvider);

        // Act
        const resolved = getProvider('docker');

        // Assert
        expect(resolved).toBe(mockDockerProvider);
        expect(resolved).not.toBeInstanceOf(DockerProvider);
    });

    it('passes optional configuration to the provider factory', () => {
        // Arrange
        const factory = vi.fn().mockReturnValue({
            setup: vi.fn(),
            cleanup: vi.fn(),
            runCommand: vi.fn(),
        });
        registerProvider('configurable', factory);
        const config = { timeout: 5000 };

        // Act
        getProvider('configurable', config);

        // Assert
        expect(factory).toHaveBeenCalledWith(config);
    });
});
