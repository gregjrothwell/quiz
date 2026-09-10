import { describe, expect, it } from 'vitest';

import {
  authEmulatorUrl,
  EMULATOR_FLAG,
  EMULATOR_HOST,
  EMULATOR_PORTS,
  emulatorsWanted,
} from './emulators';

describe('emulatorsWanted', () => {
  it('treats boolean true as wanted', () => {
    // #given Playwright's addInitScript contract
    const store = { __QUIZ_EMULATORS__: true };

    // #when the flag is read
    const wanted = emulatorsWanted(store);

    // #then emulators are on
    expect(wanted).toBe(true);
  });

  it('treats a missing flag as not wanted', () => {
    // #given a page that never set the flag — npm run dev, github.io
    const store = {};

    // #when the flag is read
    const wanted = emulatorsWanted(store);

    // #then behaviour is unchanged: live Firebase
    expect(wanted).toBe(false);
  });

  it('treats false as not wanted', () => {
    // #given an explicit off
    const store = { __QUIZ_EMULATORS__: false };

    // #when the flag is read
    const wanted = emulatorsWanted(store);

    // #then emulators stay off
    expect(wanted).toBe(false);
  });

  it('treats the string true as not wanted', () => {
    // #given the shape the App Check debug token already got wrong
    const store = { __QUIZ_EMULATORS__: 'true' };

    // #when the flag is read
    const wanted = emulatorsWanted(store);

    // #then it is not a switch
    expect(wanted).toBe(false);
  });

  it('treats 1 as not wanted', () => {
    // #given a truthy value that is not boolean true
    const store = { __QUIZ_EMULATORS__: 1 };

    // #when the flag is read
    const wanted = emulatorsWanted(store);

    // #then emulators stay off
    expect(wanted).toBe(false);
  });
});

describe('the emulator bind', () => {
  it('hardcodes loopback so a page cannot redirect Firebase', () => {
    // #given the published constants
    // #when the host is read
    // #then it is 127.0.0.1, not a hostname from the page
    expect(EMULATOR_HOST).toBe('127.0.0.1');
  });

  it('keeps auth, Firestore and the RTDB on the ports firebase.json uses', () => {
    // #given the port map Playwright and firebase.ts both import
    // #when it is read
    // #then it matches the emulator config
    expect(EMULATOR_PORTS).toEqual({ auth: 9099, firestore: 8080, database: 9000 });
  });

  it('builds the auth emulator URL from those constants, not from the page', () => {
    // #given the helper firebase.ts must call
    // #when the URL is built
    // #then it is the hardcoded origin
    expect(authEmulatorUrl()).toBe('http://127.0.0.1:9099');
  });

  it('names the flag Playwright assigns on window', () => {
    // #given the exported flag
    // #when it is compared to the global's name
    // #then they are the same string
    expect(EMULATOR_FLAG).toBe('__QUIZ_EMULATORS__');
  });
});
