pipeline {
    agent any

    environment {
        // Jenkins credential (Username with password) holding Docker Hub user + access token
        DOCKERHUB = credentials('dockerhub-creds')
        IMAGE_NAME = "${DOCKERHUB_USR}/l1portal"
        IMAGE_TAG  = "${BUILD_NUMBER}"
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'ls -la'
            }
        }

        stage('Validate') {
            steps {
                // Runs the same checks as the GitHub Actions pipeline, inside a Node container
                sh '''
                    docker run --rm -v "$PWD":/app -w /app node:20-alpine \
                        node scripts/validate.mjs L1portalv1.html
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build -t "$IMAGE_NAME:$IMAGE_TAG" -t "$IMAGE_NAME:latest" .
                    docker images "$IMAGE_NAME"
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh '''
                    echo "$DOCKERHUB_PSW" | docker login -u "$DOCKERHUB_USR" --password-stdin
                    docker push "$IMAGE_NAME:$IMAGE_TAG"
                    docker push "$IMAGE_NAME:latest"
                    docker logout
                '''
            }
        }

        stage('Deploy to Minikube') {
            steps {
                sh '''
                    sed "s|IMAGE_PLACEHOLDER|$IMAGE_NAME:$IMAGE_TAG|" k8s/deployment.yaml | kubectl apply -f -
                    kubectl apply -f k8s/service.yaml
                    kubectl rollout status deployment/l1portal --timeout=120s
                '''
            }
        }

        stage('Verify') {
            steps {
                sh '''
                    kubectl get pods -l app=l1portal -o wide
                    kubectl get svc l1portal
                    curl -fsS "http://$(minikube ip):30080/" | head -n 5
                '''
            }
        }
    }

    post {
        success { echo "Pipeline succeeded: $IMAGE_NAME:$IMAGE_TAG is running on Minikube" }
        failure { echo 'Pipeline failed: open the failed stage above to see why' }
        always  { sh 'docker logout || true' }
    }
}
