import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _app?: App;
  private _auth?: Auth;
  private _db?: Firestore;
  private seen = new Set<string>();

  onModuleInit() {
    try {
      this.app();
      this.logger.log('Firebase Admin initialised');
    } catch (e) {
      this.logger.error((e as Error).message);
    }
  }

  private app(): App {
    if (this._app) return this._app;
    const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!file || !fs.existsSync(file)) {
      throw new InternalServerErrorException(
        'Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env to your service-account JSON file.',
      );
    }
    const creds = JSON.parse(fs.readFileSync(file, 'utf-8'));
    this._app = getApps()[0] ?? initializeApp({ credential: cert(creds) });
    return this._app;
  }

  get auth(): Auth {
    return (this._auth ??= getAuth(this.app()));
  }

  get db(): Firestore {
    if (!this._db) {
      this._db = getFirestore(this.app());
      this._db.settings({ ignoreUndefinedProperties: true });
    }
    return this._db;
  }

  /** First time we see a user (per server run): create/update users/{uid}. */
  async ensureUser(u: AuthUser): Promise<void> {
    if (this.seen.has(u.uid)) return;
    const ref = this.db.doc(`users/${u.uid}`);
    const snap = await ref.get();
    const now = Date.now();
    await ref.set(
      {
        email: u.email ?? null,
        name: u.name ?? null,
        photoURL: u.picture ?? null,
        lastLoginAt: now,
        ...(snap.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );
    this.seen.add(u.uid);
  }
}
