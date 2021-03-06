import tmp, { SynchrounousResult } from 'tmp';
import { LATEST_VERSION } from '../MongoBinary';
import MongodbInstance from '../MongoInstance';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

let tmpDir: SynchrounousResult;
beforeEach(() => {
  tmp.setGracefulCleanup();
  tmpDir = tmp.dirSync({ prefix: 'mongo-mem-', unsafeCleanup: true });
});

afterEach(() => {
  tmpDir.removeCallback();
});

describe('MongodbInstance', () => {
  it('should prepare command args', () => {
    const inst = new MongodbInstance({
      instance: {
        port: 27333,
        dbPath: '/data',
        storageEngine: 'ephemeralForTest',
      },
    });
    expect(inst.prepareCommandArgs()).toEqual([
      '--bind_ip',
      '127.0.0.1',
      '--port',
      '27333',
      '--storageEngine',
      'ephemeralForTest',
      '--dbpath',
      '/data',
      '--noauth',
    ]);
  });

  it('should allow specifying replSet', () => {
    const inst = new MongodbInstance({
      instance: {
        port: 27555,
        dbPath: '/data',
        replSet: 'testset',
      },
    });
    expect(inst.prepareCommandArgs()).toEqual([
      '--bind_ip',
      '127.0.0.1',
      '--port',
      '27555',
      '--dbpath',
      '/data',
      '--noauth',
      '--replSet',
      'testset',
    ]);
  });

  it('should be able to enable auth', () => {
    const inst = new MongodbInstance({
      instance: {
        port: 27555,
        dbPath: '/data',
        auth: true,
      },
    });
    expect(inst.prepareCommandArgs()).toEqual([
      '--bind_ip',
      '127.0.0.1',
      '--port',
      '27555',
      '--dbpath',
      '/data',
      '--auth',
    ]);
  });

  it('should be able to pass arbitrary args', () => {
    const args = ['--notablescan', '--nounixsocket'];
    const inst = new MongodbInstance({
      instance: {
        port: 27555,
        dbPath: '/data',
        args,
      },
    });
    expect(inst.prepareCommandArgs()).toEqual(
      ['--bind_ip', '127.0.0.1', '--port', '27555', '--dbpath', '/data', '--noauth'].concat(args)
    );
  });

  it('should start instance on port 27333', async () => {
    const mongod = await MongodbInstance.run({
      instance: { port: 27333, dbPath: tmpDir.name },
      binary: { version: LATEST_VERSION },
    });

    expect(mongod.getPid()).toBeGreaterThan(0);

    await mongod.kill();
  });

  it('should throw error if port is busy', async () => {
    const mongod = await MongodbInstance.run({
      instance: { port: 27444, dbPath: tmpDir.name },
      binary: { version: LATEST_VERSION },
    });

    await expect(
      MongodbInstance.run({
        instance: { port: 27444, dbPath: tmpDir.name },
        binary: { version: LATEST_VERSION },
      })
    ).rejects.toBeDefined();

    await mongod.kill();
  });

  it('should await while mongo is killed', async () => {
    const mongod: MongodbInstance = await MongodbInstance.run({
      instance: { port: 27445, dbPath: tmpDir.name },
      binary: { version: LATEST_VERSION },
    });
    const pid: any = mongod.getPid();
    const killerPid: any = mongod.killerProcess && mongod.killerProcess.pid;
    expect(pid).toBeGreaterThan(0);
    expect(killerPid).toBeGreaterThan(0);

    function isPidRunning(p: number): boolean {
      try {
        process.kill(p, 0);
        return true;
      } catch (e) {
        return e.code === 'EPERM';
      }
    }

    expect(isPidRunning(pid)).toBeTruthy();
    expect(isPidRunning(killerPid)).toBeTruthy();
    await mongod.kill();
    expect(isPidRunning(pid)).toBeFalsy();
    expect(isPidRunning(killerPid)).toBeFalsy();
  });

  it('should work with mongodb 4.0.3', async () => {
    const mongod = await MongodbInstance.run({
      instance: { port: 27445, dbPath: tmpDir.name },
      binary: { version: '4.0.3' },
      debug: true,
    });
    const pid: any = mongod.getPid();
    expect(pid).toBeGreaterThan(0);
    await mongod.kill();
  });
});
