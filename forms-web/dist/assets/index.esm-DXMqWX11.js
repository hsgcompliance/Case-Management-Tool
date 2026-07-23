import{i as oe,E as se,_,g as L,a as ae,D as k,L as ce,b as le,c as ue,d as q,e as de,f as H,C as O,r as he}from"./index-C5ryMc20.js";import"./vendor-react-BjKFLRzb.js";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const P=new Map,U={activated:!1,tokenObservers:[]},fe={initialized:!1,enabled:!1};function c(t){return P.get(t)||{...U}}function pe(t,e){return P.set(t,e),P.get(t)}function y(){return fe}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const I="https://content-firebaseappcheck.googleapis.com/v1",ge="exchangeRecaptchaV3Token",ke="exchangeRecaptchaEnterpriseToken",me="exchangeDebugToken",B={RETRIAL_MIN_WAIT:30*1e3,RETRIAL_MAX_WAIT:960*1e3},Te=1440*60*1e3;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class we{constructor(e,r,n,i,o){if(this.operation=e,this.retryPolicy=r,this.getWaitDuration=n,this.lowerBound=i,this.upperBound=o,this.pending=null,this.nextErrorWaitInterval=i,i>o)throw new Error("Proactive refresh lower bound greater than upper bound!")}start(){this.nextErrorWaitInterval=this.lowerBound,this.process(!0).catch(()=>{})}stop(){this.pending&&(this.pending.reject("cancelled"),this.pending=null)}isRunning(){return!!this.pending}async process(e){this.stop();try{this.pending=new k,this.pending.promise.catch(r=>{}),await Ee(this.getNextRun(e)),this.pending.resolve(),await this.pending.promise,this.pending=new k,this.pending.promise.catch(r=>{}),await this.operation(),this.pending.resolve(),await this.pending.promise,this.process(!0).catch(()=>{})}catch(r){this.retryPolicy(r)?this.process(!1).catch(()=>{}):this.stop()}}getNextRun(e){if(e)return this.nextErrorWaitInterval=this.lowerBound,this.getWaitDuration();{const r=this.nextErrorWaitInterval;return this.nextErrorWaitInterval*=2,this.nextErrorWaitInterval>this.upperBound&&(this.nextErrorWaitInterval=this.upperBound),r}}}function Ee(t){return new Promise(e=>{setTimeout(e,t)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ae={"already-initialized":"You have already called initializeAppCheck() for FirebaseApp {$appName} with different options. To avoid this error, call initializeAppCheck() with the same options as when it was originally called. This will return the already initialized instance.","already-internally-initialized":"App Check has already been automatically initialized by {$initializerName} with default options. If you want to initialize App Check with custom options, call initializeAppCheck() with those options before initializing {$initializerName}.","use-before-activation":"App Check is being used before initializeAppCheck() is called for FirebaseApp {$appName}. Call initializeAppCheck() before instantiating other Firebase services.","fetch-network-error":"Fetch failed to connect to a network. Check Internet connection. Original error: {$originalErrorMessage}.","fetch-parse-error":"Fetch client could not parse response. Original error: {$originalErrorMessage}.","fetch-status-error":"Fetch server returned an HTTP error status. HTTP status: {$httpStatus}.","storage-open":"Error thrown when opening storage. Original error: {$originalErrorMessage}.","storage-get":"Error thrown when reading from storage. Original error: {$originalErrorMessage}.","storage-set":"Error thrown when writing to storage. Original error: {$originalErrorMessage}.","recaptcha-error":"ReCAPTCHA error.","no-provider":"No attestation provider was passed to initializeAppCheck() and no ReCAPTCHA Enterprise site key was found in the Firebase config.","initial-throttle":"{$httpStatus} error. Attempts allowed again after {$time}",throttled:"Requests throttled due to previous {$httpStatus} error. Attempts allowed again after {$time}"},d=new se("appCheck","AppCheck",Ae);/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function E(t=!1){var e;return t?(e=self.grecaptcha)==null?void 0:e.enterprise:self.grecaptcha}function D(t){if(!c(t).activated)throw d.create("use-before-activation",{appName:t.name})}function S(t){const e=Math.round(t/1e3),r=Math.floor(e/(3600*24)),n=Math.floor((e-r*3600*24)/3600),i=Math.floor((e-r*3600*24-n*3600)/60),o=e-r*3600*24-n*3600-i*60;let s="";return r&&(s+=T(r)+"d:"),n&&(s+=T(n)+"h:"),s+=T(i)+"m:"+T(o)+"s",s}function T(t){return t===0?"00":t>=10?t.toString():"0"+t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function C({url:t,body:e},r){const n={"Content-Type":"application/json"},i=r.getImmediate({optional:!0});if(i){const h=await i.getHeartbeatsHeader();h&&(n["X-Firebase-Client"]=h)}const o={method:"POST",body:JSON.stringify(e),headers:n};let s;try{s=await fetch(t,o)}catch(h){throw d.create("fetch-network-error",{originalErrorMessage:h==null?void 0:h.message})}if(s.status!==200)throw d.create("fetch-status-error",{httpStatus:s.status});let a;try{a=await s.json()}catch(h){throw d.create("fetch-parse-error",{originalErrorMessage:h==null?void 0:h.message})}const l=a.ttl.match(/^([\d.]+)(s)$/);if(!l||!l[2]||isNaN(Number(l[1])))throw d.create("fetch-parse-error",{originalErrorMessage:`ttl field (timeToLive) is not in standard Protobuf Duration format: ${a.ttl}`});const u=Number(l[1])*1e3,p=Date.now();return{token:a.token,expireTimeMillis:p+u,issuedAtTimeMillis:p}}function be(t,e){const{projectId:r,appId:n,apiKey:i}=t.options;return{url:`${I}/projects/${r}/apps/${n}:${ge}?key=${i}`,body:{recaptcha_v3_token:e}}}function _e(t,e){const{projectId:r,appId:n,apiKey:i}=t.options;return{url:`${I}/projects/${r}/apps/${n}:${ke}?key=${i}`,body:{recaptcha_enterprise_token:e}}}function W(t,e){const{projectId:r,appId:n,apiKey:i}=t.options;return{url:`${I}/projects/${r}/apps/${n}:${me}?key=${i}`,body:{debug_token:e}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ye="firebase-app-check-database",Ce=1,m="firebase-app-check-store",j="debug-token";let w=null;function G(){return w||(w=new Promise((t,e)=>{try{const r=indexedDB.open(ye,Ce);r.onsuccess=n=>{t(n.target.result)},r.onerror=n=>{var i;e(d.create("storage-open",{originalErrorMessage:(i=n.target.error)==null?void 0:i.message}))},r.onupgradeneeded=n=>{const i=n.target.result;switch(n.oldVersion){case 0:i.createObjectStore(m,{keyPath:"compositeKey"})}}}catch(r){e(d.create("storage-open",{originalErrorMessage:r==null?void 0:r.message}))}}),w)}function ve(t){return V(Y(t))}function Re(t,e){return X(Y(t),e)}function Pe(t){return X(j,t)}function Ie(){return V(j)}async function X(t,e){const n=(await G()).transaction(m,"readwrite"),o=n.objectStore(m).put({compositeKey:t,value:e});return new Promise((s,a)=>{o.onsuccess=l=>{s()},n.onerror=l=>{var u;a(d.create("storage-set",{originalErrorMessage:(u=l.target.error)==null?void 0:u.message}))}})}async function V(t){const r=(await G()).transaction(m,"readonly"),i=r.objectStore(m).get(t);return new Promise((o,s)=>{i.onsuccess=a=>{const l=a.target.result;o(l?l.value:void 0)},r.onerror=a=>{var l;s(d.create("storage-get",{originalErrorMessage:(l=a.target.error)==null?void 0:l.message}))}})}function Y(t){return`${t.options.appId}-${t.name}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const f=new ce("@firebase/app-check");/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function De(t){if(q()){let e;try{e=await ve(t)}catch(r){f.warn(`Failed to read token from IndexedDB. Error: ${r}`)}return e}}function v(t,e){return q()?Re(t,e).catch(r=>{f.warn(`Failed to write token to IndexedDB. Error: ${r}`)}):Promise.resolve()}async function Se(){let t;try{t=await Ie()}catch{}if(t)return t;{const e=crypto.randomUUID();return Pe(e).catch(r=>f.warn(`Failed to persist debug token to IndexedDB. Error: ${r}`)),e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function N(){return y().enabled}async function x(){const t=y();if(t.enabled&&t.token)return t.token.promise;throw Error(`
            Can't get debug token in production mode.
        `)}function Ne(){const t=le(),e=y();if(e.initialized=!0,typeof t.FIREBASE_APPCHECK_DEBUG_TOKEN!="string"&&t.FIREBASE_APPCHECK_DEBUG_TOKEN!==!0)return;e.enabled=!0;const r=new k;e.token=r,typeof t.FIREBASE_APPCHECK_DEBUG_TOKEN=="string"?r.resolve(t.FIREBASE_APPCHECK_DEBUG_TOKEN):r.resolve(Se())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xe={error:"UNKNOWN_ERROR"};function Me(t){return de.encodeString(JSON.stringify(t),!1)}async function A(t,e=!1,r=!1){const n=t.app;D(n);const i=c(n);let o=i.token,s;if(o&&!g(o)&&(i.token=void 0,o=void 0),!o){const u=await i.cachedTokenPromise;u&&(g(u)?o=u:await v(n,void 0))}if(!e&&o&&g(o))return{token:o.token};let a=!1;if(N())try{const u=await x();i.exchangeTokenPromise||(i.exchangeTokenPromise=C(W(n,u),t.heartbeatServiceProvider).finally(()=>{i.exchangeTokenPromise=void 0}),a=!0);const p=await i.exchangeTokenPromise;return await v(n,p),i.token=p,{token:p.token}}catch(u){return u.code==="appCheck/throttled"||u.code==="appCheck/initial-throttle"?f.warn(u.message):r&&f.error(u),R(u)}try{i.exchangeTokenPromise||(i.exchangeTokenPromise=i.provider.getToken().finally(()=>{i.exchangeTokenPromise=void 0}),a=!0),o=await c(n).exchangeTokenPromise}catch(u){u.code==="appCheck/throttled"||u.code==="appCheck/initial-throttle"?f.warn(u.message):r&&f.error(u),s=u}let l;return o?s?g(o)?l={token:o.token,internalError:s}:l=R(s):(l={token:o.token},i.token=o,await v(n,o)):l=R(s),a&&Q(n,l),l}async function J(t){const e=t.app;D(e);const{provider:r}=c(e);if(N()){const n=await x(),i=W(e,n);i.body.limited_use=!0;const{token:o}=await C(i,t.heartbeatServiceProvider);return{token:o}}else{const{token:n}=await r.getToken(!0);return{token:n}}}function M(t,e,r,n){const{app:i}=t,o=c(i),s={next:r,error:n,type:e};if(o.tokenObservers=[...o.tokenObservers,s],o.token&&g(o.token)){const a=o.token;Promise.resolve().then(()=>{r({token:a.token}),K(t)}).catch(()=>{})}o.cachedTokenPromise.then(()=>K(t))}function $(t,e){const r=c(t),n=r.tokenObservers.filter(i=>i.next!==e);n.length===0&&r.tokenRefresher&&r.tokenRefresher.isRunning()&&r.tokenRefresher.stop(),r.tokenObservers=n}function K(t){const{app:e}=t,r=c(e);let n=r.tokenRefresher;n||(n=$e(t),r.tokenRefresher=n),!n.isRunning()&&r.isTokenAutoRefreshEnabled&&n.start()}function $e(t){const{app:e}=t;return new we(async()=>{const r=c(e);let n;if(r.token?n=await A(t,!0):n=await A(t),n.error)throw n.error;if(n.internalError)throw n.internalError},()=>!0,()=>{const r=c(e);if(r.token){let n=r.token.issuedAtTimeMillis+(r.token.expireTimeMillis-r.token.issuedAtTimeMillis)*.5+3e5;const i=r.token.expireTimeMillis-300*1e3;return n=Math.min(n,i),Math.max(0,n-Date.now())}else return 0},B.RETRIAL_MIN_WAIT,B.RETRIAL_MAX_WAIT)}function Q(t,e){const r=c(t).tokenObservers;for(const n of r)try{n.type==="EXTERNAL"&&e.error!=null?n.error(e.error):n.next(e)}catch{}}function g(t){return t.expireTimeMillis-Date.now()>0}function R(t){return{token:Me(xe),error:t}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ze{constructor(e,r){this.app=e,this.heartbeatServiceProvider=r}_delete(){const{tokenObservers:e}=c(this.app);for(const r of e)$(this.app,r.next);return Promise.resolve()}}function He(t,e){return new ze(t,e)}function Oe(t){return{getToken:e=>A(t,e),getLimitedUseToken:()=>J(t),addTokenListener:e=>M(t,"INTERNAL",e),removeTokenListener:e=>$(t.app,e)}}const Be="@firebase/app-check",Ke="0.12.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fe="https://www.google.com/recaptcha/api.js",Le="https://www.google.com/recaptcha/enterprise.js";function qe(t,e){const r=new k,n=c(t);n.reCAPTCHAState={initialized:r};const i=Z(t),o=E(!1);return o?b(t,e,o,i,r):je(()=>{const s=E(!1);if(!s)throw new Error("no recaptcha");b(t,e,s,i,r)}),r.promise}function Ue(t,e){const r=new k,n=c(t);n.reCAPTCHAState={initialized:r};const i=Z(t),o=E(!0);return o?b(t,e,o,i,r):Ge(()=>{const s=E(!0);if(!s)throw new Error("no recaptcha");b(t,e,s,i,r)}),r.promise}function b(t,e,r,n,i){r.ready(()=>{We(t,e,r,n),i.resolve(r)})}function Z(t){const e=`fire_app_check_${t.name}`,r=document.createElement("div");return r.id=e,r.style.display="none",document.body.appendChild(r),e}async function ee(t){D(t);const r=await c(t).reCAPTCHAState.initialized.promise;return new Promise((n,i)=>{const o=c(t).reCAPTCHAState;r.ready(()=>{n(r.execute(o.widgetId,{action:"fire_app_check"}))})})}function We(t,e,r,n){const i=r.render(n,{sitekey:e,size:"invisible",callback:()=>{c(t).reCAPTCHAState.succeeded=!0},"error-callback":()=>{c(t).reCAPTCHAState.succeeded=!1}}),o=c(t);o.reCAPTCHAState={...o.reCAPTCHAState,widgetId:i}}function je(t){const e=document.createElement("script");e.src=Fe,e.onload=t,document.head.appendChild(e)}function Ge(t){const e=document.createElement("script");e.src=Le+"?render=explicit",e.onload=t,document.head.appendChild(e)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class te{constructor(e){this._siteKey=e,this._throttleData=null}async getToken(e=!1){var i,o,s;ie(this._throttleData);const r=await ee(this._app).catch(a=>{throw d.create("recaptcha-error")});if(!((i=c(this._app).reCAPTCHAState)!=null&&i.succeeded))throw d.create("recaptcha-error");let n;try{const a=be(this._app,r);e&&(a.body.limited_use=!0),n=await C(a,this._heartbeatServiceProvider)}catch(a){throw(o=a.code)!=null&&o.includes("fetch-status-error")?(this._throttleData=ne(Number((s=a.customData)==null?void 0:s.httpStatus),this._throttleData),d.create("initial-throttle",{time:S(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):a}return this._throttleData=null,n}initialize(e){this._app=e,this._heartbeatServiceProvider=_(e,"heartbeat"),qe(e,this._siteKey).catch(()=>{})}isEqual(e){return e instanceof te?this._siteKey===e._siteKey:!1}}class z{constructor(e){this._siteKey=e,this._throttleData=null}async getToken(e=!1){var i,o,s;ie(this._throttleData);const r=await ee(this._app).catch(a=>{throw d.create("recaptcha-error")});if(!((i=c(this._app).reCAPTCHAState)!=null&&i.succeeded))throw d.create("recaptcha-error");let n;try{const a=_e(this._app,r);e&&(a.body.limited_use=!0),n=await C(a,this._heartbeatServiceProvider)}catch(a){throw(o=a.code)!=null&&o.includes("fetch-status-error")?(this._throttleData=ne(Number((s=a.customData)==null?void 0:s.httpStatus),this._throttleData),d.create("initial-throttle",{time:S(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):a}return this._throttleData=null,n}initialize(e){this._app=e,this._heartbeatServiceProvider=_(e,"heartbeat"),Ue(e,this._siteKey).catch(()=>{})}isEqual(e){return e instanceof z?this._siteKey===e._siteKey:!1}}class re{constructor(e){this._customProviderOptions=e}async getToken(){const e=await this._customProviderOptions.getToken(),r=oe(e.token),n=r!==null&&r<Date.now()&&r>0?r*1e3:Date.now();return{...e,issuedAtTimeMillis:n}}initialize(e){this._app=e}isEqual(e){return e instanceof re?this._customProviderOptions.getToken.toString()===e._customProviderOptions.getToken.toString():!1}}function ne(t,e){if(t===404||t===403)return{backoffCount:1,allowRequestsAfter:Date.now()+Te,httpStatus:t};{const r=e?e.backoffCount:0,n=ue(r,1e3,2);return{backoffCount:r+1,allowRequestsAfter:Date.now()+n,httpStatus:t}}}function ie(t){if(t&&Date.now()-t.allowRequestsAfter<=0)throw d.create("throttled",{time:S(t.allowRequestsAfter-Date.now()),httpStatus:t.httpStatus})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xe(t=L(),e){var s;t=ae(t),y().initialized||Ne(),N()&&x().then(a=>console.log(`App Check debug token: ${a}. You will need to add it to your app's App Check settings in the Firebase console for it to work.`));let r;if(!(e!=null&&e.provider)&&t.options.recaptchaSiteKey&&(r=new z(t.options.recaptchaSiteKey)),!(e!=null&&e.provider)&&!r)throw d.create("no-provider");const n={...e,provider:(e==null?void 0:e.provider)||r},i=_(t,"app-check");if(i.isInitialized()){const a=i.getImmediate(),l=i.getOptions();if(l.isTokenAutoRefreshEnabled===n.isTokenAutoRefreshEnabled&&((s=l.provider)!=null&&s.isEqual(n.provider)))return a;throw typeof c(t).internallyInitializedBy=="string"?d.create("already-internally-initialized",{initializerName:c(t).internallyInitializedBy}):d.create("already-initialized",{appName:t.name})}const o=i.initialize({options:n});return Ve(t,n.provider,n.isTokenAutoRefreshEnabled),c(t).isTokenAutoRefreshEnabled&&M(o,"INTERNAL",()=>{}),o}function et(t,e=L(),r){const n=_(e,"app-check");if(n.isInitialized())return n.getImmediate();{const o=Xe(e,r);return c(e).internallyInitializedBy=t,o}}function Ve(t,e,r=!1){const n=pe(t,{...U});n.activated=!0,n.provider=e,n.cachedTokenPromise=De(t).then(i=>(i&&g(i)&&(n.token=i,Q(t,{token:i.token})),i)),n.isTokenAutoRefreshEnabled=r&&t.automaticDataCollectionEnabled,!t.automaticDataCollectionEnabled&&r&&f.warn("`isTokenAutoRefreshEnabled` is true but `automaticDataCollectionEnabled` was set to false during `initializeApp()`. This blocks automatic token refresh."),n.provider.initialize(t)}function tt(t,e){const r=t.app,n=c(r);n.tokenRefresher&&(e===!0?n.tokenRefresher.start():n.tokenRefresher.stop()),n.isTokenAutoRefreshEnabled=e}async function rt(t,e){const r=await A(t,e);if(r.error)throw r.error;if(r.internalError)throw r.internalError;return{token:r.token}}function nt(t){return J(t)}function it(t,e,r,n){let i=()=>{},o=()=>{};return e.next!=null?i=e.next.bind(e):i=e,e.error!=null?o=e.error.bind(e):r&&(o=r),M(t,"EXTERNAL",i,o),()=>$(t.app,i)}const Ye="app-check",F="app-check-internal";function Je(){H(new O(Ye,t=>{const e=t.getProvider("app").getImmediate(),r=t.getProvider("heartbeat");return He(e,r)},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((t,e,r)=>{t.getProvider(F).initialize()})),H(new O(F,t=>{const e=t.getProvider("app-check").getImmediate();return Oe(e)},"PUBLIC").setInstantiationMode("EXPLICIT")),he(Be,Ke)}Je();export{re as CustomProvider,z as ReCaptchaEnterpriseProvider,te as ReCaptchaV3Provider,et as _initializeAppCheckInternal,nt as getLimitedUseToken,rt as getToken,Xe as initializeAppCheck,it as onTokenChanged,tt as setTokenAutoRefreshEnabled};
