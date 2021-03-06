// a simple utility that is used during developement to drop a bucket
import logger from './util/logger'
import {
  option,
  parseOptions,
  printCurrentOptions,
  requiredValidator,
  toolOptionDefinitions,
} from './env'
import {readFileSync} from 'fs'
import {getV1Authorizations, postPassword} from './v2/v2-authv1-api'
import {v2OptionDefinitions} from './v2/options'

const localOptions = {
  usersFile: '',
  defaultPassword: '',
}

async function main(): Promise<void> {
  if (!localOptions.usersFile) {
    throw new Error('Missing --users-file!')
  }
  const users = JSON.parse(
    readFileSync(localOptions.usersFile, {encoding: 'utf8'})
  )
  if (!Array.isArray(users)) {
    throw new Error('Invalid content of users-file, array expected!')
  }

  const userToAuthId = (await getV1Authorizations()).reduce((acc, v1Auth) => {
    acc[v1Auth.token] = v1Auth.id as string
    return acc
  }, {} as Record<string, string>)
  logger.info(`--- Setting passwords for users[${users.length}] ---`)
  for (const user of users) {
    if (user && user.name) {
      const authorizationId = userToAuthId[user.name]
      if (!authorizationId) {
        logger.warn(user.name, `is ignored, no existing authorization found!`)
        continue
      }
      try {
        if (user.password) {
          await postPassword(user.authorizationId, user.password)
          logger.info(user.name, `: password set from users-file`)
        } else if (localOptions.defaultPassword) {
          await postPassword(user.authorizationId, localOptions.defaultPassword)
          logger.info(user.name, `: now uses default password`)
        } else {
          logger.warn(user.name, `: user is ignored, no password specified`)
        }
      } catch (e) {
        logger.error(user.name, `: unable to set password`, e)
      }
      continue
    }
    logger.warn(
      'ignored',
      `user entry ${JSON.stringify(user)} is not recognized`
    )
  }
}

const cmdLine = {
  description:
    'Set-password sets user passwords in InfluxDB v2 authorizations.',
  usage: 'set-password [options]',
  opts: [
    ...v2OptionDefinitions,
    ...toolOptionDefinitions,
    option(
      'users-file',
      localOptions,
      'usersFile',
      'USERS_FILE',
      'path to users file',
      requiredValidator
    ),
    option(
      'password',
      localOptions,
      'defaultPassword',
      'DEFAULT_PASSWORD',
      'default password, when missing in users-file'
    ),
  ],
}
parseOptions(cmdLine)
printCurrentOptions(cmdLine)

main()
  .then(() => {
    logger.info('')
    logger.info('Finished SUCCESS')
  })
  .catch(e => {
    logger.error(e)
    logger.error('')
    logger.error('Finished FAILED')
  })
