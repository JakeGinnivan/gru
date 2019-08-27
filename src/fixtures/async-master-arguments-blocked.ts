import { gru } from '..'
import { consoleLogger } from 'typescript-log'

interface Args {
    test: number
    test2: string[]
}
gru<Args>({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 1,
    masterArgsWait: 1,
    master: () =>
        new Promise(resolve => setTimeout(resolve, 1)).then<Args>(() => {
            setTimeout(() => {
                const end = Date.now() + 100
                while (Date.now() < end) {
                    // @ts-ignore
                    const blocking = 1 + 2 + 3
                }
            })

            // eslint-disable-next-line no-console
            console.log('master')

            return { test: 1, test2: ['val'] }
        }),
    start: ({ masterArgs }) => {
        // eslint-disable-next-line no-console
        console.log('worker', masterArgs)
        process.exit()
    },
})
