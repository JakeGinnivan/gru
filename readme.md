# Gru

Gru is a node clustering helper, because he is the master of the minions

![Gru](./assets/gru.jpg)

Is a Fork of https://github.com/hunterloftis/throng with a few added features:

## Master and worker initialisation

If you return a promise from the `master` function, it will wait for the promise to resolve before starting workers. If the promise rejects it will exit the process.

When the workers return a promise it represents the worker starting, if the promise rejects the worker has failed and will not be restarted.

Once a worker sucessfully starts the lifetime rules will apply.

## Master state

The master function's promise can return a plan JavaScript object (which you can type by using the Generic argument on the throng function). When workers start it will be sent via messaging to the worker then passed as an argument to the worker start function.

This is handy for passing configuration or any other data which you want to only resolve once in the master and make available for the worker.

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
        // Worker initialisation
    },
})
```
