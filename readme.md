# Gru

Gru is a node clustering helper, because he is the master of the minions

![Gru](./assets/gru.jpg)

Is a Fork of https://github.com/hunterloftis/throng with quite a few improvements relating to having a separate startup and running phase.

A single master can control two kinds of workers:

- Generic workers. Workers who all perform the same task

- Dedicated workers. Workers who each perform a unique task.

## Usage

```ts
import { gru } from 'gru'

const numCpus = os.cpus().length

gru({
    workers: process.env.NODE_ENV === 'production' ? numCpus : 1,
    lifetime: Infinity,
    master: async () => {
        // Master initialisation here
    },
    start: async () => {
        // Generic worker initialisation
    },
    dedicatedWorkers: {
        uniqueTask1: () => {
            // Dedicated worker initialization
        },
        uniqueTask2: () => {
            // Dedicated worker initialization
        },
    },
})
```

## API

### gru options

### workers

Number of generic workers, if 0, starts in process (useful for debugging). Defaults to # of cpu cores

### lifetime

ms to keep cluster alive or `'until-killed'`

### grace

ms grace period after worker SIGTERM (default 5000)

### logger

Compatible with Bunyan, Winston and TypeScript-log style logging interfaces, logs gru activity

### master

The master process callback.

Optionally can return a promise if there is startup work before worker is considered started.

If the returned promise resolves a value, it will be passed to the workers.

#### example

```ts
gru({
    master: async () => {
        const config = await loadConfig()

        return { config }
    },
    start: ({ masterArgs }) => {
        masterArgs.config // will be the config returned from the master process
    },
})
```

### start

The worker callback.

If the worker returns a promise and it rejects, it signals to gru that the worker failed to start and will not be restarted.
Once a worker has started the lifecycle policy will apply (ie workers which crash will be restarted)

### dedicatedWorkers

The set of unique worker processes.

#### example

```ts
gru({
    master: async () => {
    },
    start: () => {
    },
    dedicatedWorkers: {
        express: () => {
            // Start an Express server
        },
        fileIngestion: () => {
            // Monitor a directory for zip files to process
        },
    },
})
```