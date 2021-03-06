import Ember from "ember";
import config from "../config/environment";
import ajax from "../utils/ajax";
import { getAccessToken, setAccessToken } from '../adapters/application';

function clearSession(){
  setAccessToken(null);
}

function persistSession(accessToken){
  setAccessToken(accessToken);
}

function pushTokenToStore(tokenPayload, store) {
  return store.push('token', {
    id: tokenPayload.id,
    accessToken: tokenPayload.access_token,
    rawPayload: JSON.stringify(tokenPayload),
    links: {
      user: tokenPayload._links.user.href,
      actor: tokenPayload._links.actor && tokenPayload._links.actor.href
    }
  });
}

export default Ember.Object.extend({
  store: Ember.inject.service(),
  analytics: Ember.inject.service(),
  _authenticateWithPayload(tokenPayload) {
    var store = this.get('store');
    return new Ember.RSVP.Promise(function(resolve){
      persistSession(tokenPayload.access_token);
      resolve(pushTokenToStore(tokenPayload, store));
    }).then((token) => {
      return Ember.RSVP.hash({
        token,
        currentUser: token.get('user'),
        currentActor: token.get('actor')
      });
    }).then((session) => {
      // Load role eagerly
      return session.currentUser.get('roles').then(() => {
        return session;
      });
    }).then((session) => {
      this.identifyToAnalytics(session.currentUser);
      return session;
    }).catch(function(e){
      clearSession();
      throw e;
    });
  },

  fetch() {
    return ajax(config.authBaseUri+'/current_token', {
      type: 'GET',
      xhrFields: { withCredentials: true }
    }).then((tokenPayload) => {
      return this._authenticateWithPayload(tokenPayload);
    }).catch(function(jqXHR){
      if (jqXHR.responseJSON) {
        throw new Error(jqXHR.responseJSON.message);
      } else if (jqXHR.responseText) {
        throw new Error(jqXHR.responseText);
      } else {
        throw jqXHR;
      }
    });
  },

  open(tokenPayload) {
    return this._authenticateWithPayload(tokenPayload);
  },

  close(token) {
    Ember.assert(
      `A token must be passed: session.close('aptible', /*token*/);`,
      !!token
    );

    let promise;

    if (!!token.noDelete) {
      promise = new Ember.RSVP.Promise((resolve, _) => resolve());
    } else {
      promise = ajax(config.authBaseUri+`/tokens/${token.get('id')}`, {
        type: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + getAccessToken()
        },
        xhrFields: { withCredentials: true }
      });
    }

    return promise.then(() => { clearSession(); });
  },

  identifyToAnalytics(user) {
    const email = user.get('email');
    this.get('analytics').identify(user.get('id'), {
      email: email,
      id: user.get('id'),
      name: user.get('name'),
      createdAt: user.get('createdAt')
    });
  }

});
