#!/bin/bash
#The below script deploys a sample application

### PVC TESTING YAML FILE
cat <<EOF > pvc-test.yml #Creating file
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-test
spec:
  accessModes:
    - ReadWriteOnce
  #Match the below value with available storage class
  storageClassName: gp2 
  resources:
    requests:
      storage: 1Gi

---
apiVersion: v1
kind: Pod
metadata:
  name: pod-test
spec:
  containers:
  - name: test-container
    image: alpine   # Tiny image
    command: ["sleep", "3600"]
    volumeMounts:
    - mountPath: "/mnt/test"    
      name: ebs-volume
  volumes:
  - name: ebs-volume
    persistentVolumeClaim:
      claimName: pvc-test
EOF

### LB TESTING YAML FILE
cat <<EOF > lb-test.yml #Creating file 
apiVersion: v1
kind: Service
metadata:
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-additional-resource-tags: Name=nlb-verification
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-port: traffic-port
    service.beta.kubernetes.io/aws-load-balancer-ip-address-type: ipv4
    service.beta.kubernetes.io/aws-load-balancer-name: opsmxnlb
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: instance
    #service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
    service.beta.kubernetes.io/aws-load-balancer-scheme: internal
    service.beta.kubernetes.io/aws-load-balancer-subnets: subnet-04480eef9655bd567, subnet-0384ee7e483f4737d
    service.beta.kubernetes.io/aws-load-balancer-security-groups: sg-0797c17b80a6daf0d
    service.beta.kubernetes.io/aws-load-balancer-manage-backend-security-group-rules: "false"
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
  labels:
    app: ssd
  name: nlb-svc
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
  - name: rabbitmq
    nodePort: 30301
    port: 8080
    protocol: TCP
    targetPort: 8080

---    
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: alb-ing
  annotations:
    alb.ingress.kubernetes.io/load-balancer-name: opsmxalb
    alb.ingress.kubernetes.io/ip-address-type: ipv4
    #alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/scheme: internal
    alb.ingress.kubernetes.io/healthcheck-protocol: HTTP
    alb.ingress.kubernetes.io/healthcheck-port: traffic-port
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '3'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '5'
    alb.ingress.kubernetes.io/success-codes: '200'
    alb.ingress.kubernetes.io/subnets: subnet-04480eef9655bd567, subnet-0384ee7e483f4737d
    alb.ingress.kubernetes.io/security-groups: k8s-gd-rabbitmq-07089dcc75, sg-00490d29dc05dde47
    alb.ingress.kubernetes.io/manage-backend-security-group-rules: "false"
spec:
  ingressClassName: alb
  rules:
    - http:
         paths:
           - path: /v1
             pathType: Prefix
             backend:
               service:
                 name: web
                 port:
                   number: 8080
           - path: /
             pathType: Prefix
             backend:
               service:
                 name: web
                 port:
                   number: 8080

EOF

### TESTING PVC AND LB

set -x #Debug mode details ON

helm list -A
kubectl get storageclass
kubectl get ingressclass

#Create a dedicated namespace for testing
kubectl create ns test

#Create a sample web application as deployment
kubectl -n test create deployment web --image=gcr.io/google-samples/hello-app:1.0

#Create NodePort service for LoadBalancer to send traffic to
kubectl -n test expose deployment web --type=NodePort --port=8080

#Apply the PVC yaml file to setup a PVC
kubectl -n test apply -f pvc-test.yml

#Create a LB objects (Ingress and Service), they should create a Load Balancers automatically
kubectl -n test apply -f lb-test.yml

#Wait for a 30 secs for provisioning
echo "Waiting for 30 secs for provisioning"
sleep 30

#Check if the new PVC has been provisioned
kubectl -n test get pvc

#Verify if a Load Balancer is created
kubectl -n test get ing
kubectl -n test get svc

#Verify if ALB and NLB is connecting (any one command is enough)
#nc -zv <LB_HOST> <LB_PORT> #[or]
#telnet -v <LB_HOST> <LB_PORT> #[or]
#curl -v telnet://<LB_HOST>:<LB_PORT>

# Clean the LB resources including Ing and Svc
#kubectl -n test delete -f lb-test.yml

set +x #Debug mode details OFF
