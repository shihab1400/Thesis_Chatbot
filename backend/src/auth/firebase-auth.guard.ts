import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

/** Requires "Authorization: Bearer <Firebase ID token>" on every request. */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Please sign in.');

    const auth = this.firebase.auth; // throws a clear 500 if Firebase isn't configured
    let decoded: { uid: string; email?: string; name?: string; picture?: string };
    try {
      decoded = await auth.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException(
        'Your session is invalid or expired. Please sign in again.',
      );
    }

    const user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
    await this.firebase.ensureUser(user);
    req.user = user;
    return true;
  }
}
